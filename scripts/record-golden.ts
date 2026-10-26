// Records what the real model reads from each fixture into golden/llm/<fixture>.<promptId>.json,
// the replies the offline tests replay (requirements 4.4). Every call spends shared free-tier
// quota, so the script refuses any flag it does not know (a typo must never record everything),
// records only fixtures that have no recording yet unless one is named with --only, and stops at
// the first failure. Run: npm run record:golden [-- --dry-run | -- --only <fixture>]

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { format, resolveConfig } from 'prettier';
import type { z } from 'zod';

import { canonicalise } from '@/core/grounding/canonical-text';
import { locateQuote } from '@/core/grounding/quote-match';
import type { MessageFactsInput } from '@/core/messages/fact-types';
import { buildMessageFacts } from '@/core/messages/message-facts';
import { BriefReading } from '@/schemas/readings/brief-reading';
import { ChangeReading } from '@/schemas/readings/change-reading';
import { FamilyUpdateDraft } from '@/schemas/readings/family-update-draft';
import { QuoteReading } from '@/schemas/readings/quote-reading';
import { todayInIndia } from '@/server/config/clock';
import { loadKeyPool } from '@/server/config/key-pool';
import { GatewayBugError } from '@/server/genai/classify';
import { defaultGateway } from '@/server/genai/gateway';
import type { LlmGateway, PromptSpec } from '@/server/pipeline/llm-gateway';
import { SCHEMA_VERSIONS } from '@/server/pipeline/schema-versions';
import * as brief from '@/server/prompts/brief';
import * as change from '@/server/prompts/change';
import * as familyUpdate from '@/server/prompts/family-update';
import * as quote from '@/server/prompts/quote';
import { PROMPTS, type PromptId } from '@/server/prompts/registry';

export const FIXTURES_DIR = join(process.cwd(), 'fixtures');
export const GOLDEN_DIR = join(process.cwd(), 'golden', 'llm');

// D33 budgets one draft call. Hindi is the language the persona's parents read and the one the
// video shows (beat 12), and it is where a template reads stiffest (D07).
const DRAFT_LANGUAGE: familyUpdate.FamilyUpdateLanguage = 'hi';

interface Route {
  readonly prefix: string;
  readonly extension: '.txt' | '.json';
  readonly prompt: PromptSpec;
  readonly schema: z.ZodType;
  readonly cacheInputs: readonly string[];
  readonly toText: (raw: string) => string;
}

// The readers are sent the canonical text, as the read pipelines send it.
function reader(prefix: string, prompt: PromptSpec, schema: z.ZodType): Route {
  const toText = (raw: string): string => canonicalise(raw).text;
  return { prefix, extension: '.txt', prompt, schema, cacheInputs: [], toText };
}

// Keyed by the registry's prompt ids, so adding a prompt without a route fails to compile; the
// fake gateway routes on the same ids, so a recording lands where replay looks for it.
const ROUTES: Readonly<Record<PromptId, Route>> = {
  brief: reader('brief-', brief, BriefReading),
  quote: reader('quote-', quote, QuoteReading),
  change: reader('change-', change, ChangeReading),
  familyUpdate: {
    prefix: 'family-update-',
    extension: '.json',
    prompt: familyUpdate.promptFor(DRAFT_LANGUAGE),
    schema: FamilyUpdateDraft,
    cacheInputs: [DRAFT_LANGUAGE, familyUpdate.register],
    // The app sends the built facts, so the fixture goes through the same builder.
    toText: (raw) => JSON.stringify(buildMessageFacts(JSON.parse(raw) as MessageFactsInput)),
  },
};

// The registry's order and ids, the same list the fake gateway and the guardrail tests use.
const ROUTED_IDS = PROMPTS.map((prompt) => prompt.id as PromptId);

/** The prompt a fixture file is read by, from its name; undefined when no prompt reads it. */
export function routeFixture(fileName: string): PromptId | undefined {
  const extension = extname(fileName);
  return ROUTED_IDS.find(
    (id) => fileName.startsWith(ROUTES[id].prefix) && ROUTES[id].extension === extension,
  );
}

/** Every fixture by name (no extension); a file no prompt reads is an error, not a skip. */
export function listFixtures(dir: string = FIXTURES_DIR): Map<string, PromptId> {
  const fixtures = new Map<string, PromptId>();
  for (const file of readdirSync(dir).sort()) {
    const promptId = routeFixture(file);
    if (promptId === undefined) throw new Error(`No prompt reads fixtures/${file}.`);
    fixtures.set(basename(file, extname(file)), promptId);
  }
  return fixtures;
}

export type ParsedArgs =
  | { readonly ok: true; readonly only: string | null; readonly dryRun: boolean }
  | { readonly ok: false; readonly error: string };

export const USAGE = 'Usage: npm run record:golden [-- --dry-run] [-- --only <fixture>]';

/** Reads the command line strictly: anything not understood refuses the whole run. */
export function parseArgs(argv: readonly string[], fixtures: ReadonlySet<string>): ParsedArgs {
  let only: string | null = null;
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run' && !dryRun) {
      dryRun = true;
    } else if (arg === '--only' && only === null) {
      const name = argv[index + 1];
      if (name === undefined || name.startsWith('-'))
        return { ok: false, error: '--only needs a fixture name.' };
      if (!fixtures.has(name)) return { ok: false, error: `Unknown fixture "${name}".` };
      only = name;
      index += 1;
    } else {
      return { ok: false, error: `Unrecognised or repeated argument "${String(arg)}".` };
    }
  }
  return { ok: true, only, dryRun };
}

export function recordingPath(promptId: PromptId, fixture: string): string {
  return join(GOLDEN_DIR, `${fixture}.${promptId}.json`);
}

/** How many of the reading's quotes occur in the text: a hand-review aid, not the pipeline's verdict. */
export function quoteTally(value: unknown, text: string): { found: number; total: number } {
  const source = canonicalise(text);
  const tally = { found: 0, total: 0 };
  const visit = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    for (const [key, child] of Object.entries(node)) {
      if (key === 'quote' && typeof child === 'string' && child !== '') {
        tally.total += 1;
        if (locateQuote(source, child).kind === 'found') tally.found += 1;
      } else {
        visit(child);
      }
    }
  };
  visit(value);
  return tally;
}

function reviewLine(promptId: PromptId, raw: string, value: unknown): string {
  // A draft has no quotes; the messages pipeline number-checks it against the facts.
  if (promptId === 'familyUpdate') return 'draft recorded';
  const { found, total } = quoteTally(value, raw);
  return `${String(found)} of ${String(total)} quotes found in the text`;
}

async function recordOne(
  gateway: LlmGateway,
  fixture: string,
  promptId: PromptId,
  keys: readonly string[],
): Promise<boolean> {
  const route = ROUTES[promptId];
  const raw = readFileSync(join(FIXTURES_DIR, `${fixture}${route.extension}`), 'utf8');
  let result;
  try {
    result = await gateway.extract({
      prompt: route.prompt,
      schema: route.schema,
      schemaVersion: SCHEMA_VERSIONS[promptId],
      text: route.toText(raw),
      origin: { kind: 'typed' },
      cacheInputs: route.cacheInputs,
    });
  } catch (error: unknown) {
    if (!(error instanceof GatewayBugError)) throw error;
    console.error(`${fixture}: ${error.message}`);
    return false;
  }
  if (result.kind !== 'reading') {
    const why = result.kind === 'unavailable' ? result.reason : result.kind;
    console.error(`${fixture}: no reading (${why}).`);
    return false;
  }
  // The shape the example book reads (pipeline/example-readings.ts); extra keys are ignored there.
  const recording = {
    fixture,
    promptId,
    promptVersion: route.prompt.version,
    schemaVersion: SCHEMA_VERSIONS[promptId],
    cacheInputs: route.cacheInputs,
    answeredBy: result.answeredBy,
    recordedOn: todayInIndia(),
    reply: result.value,
  };
  const path = recordingPath(promptId, fixture);
  const json = await format(JSON.stringify(recording), {
    ...(await resolveConfig(path)),
    filepath: path,
  });
  // Belt and braces: nothing above comes from the environment, but a key must never be committed.
  if (keys.some((key) => json.includes(key)))
    throw new Error(`${fixture}: a key reached the recording; nothing written.`);
  mkdirSync(GOLDEN_DIR, { recursive: true });
  writeFileSync(path, json, 'utf8');
  console.log(`${fixture}: ${reviewLine(promptId, raw, result.value)} (${result.answeredBy})`);
  return true;
}

async function main(argv: readonly string[]): Promise<number> {
  if (ROUTED_IDS.some((id) => ROUTES[id].prompt.id !== id)) {
    throw new Error('A recorder route names a different prompt than its registry id.');
  }
  const fixtures = listFixtures();
  const parsed = parseArgs(argv, new Set(fixtures.keys()));
  if (!parsed.ok) {
    console.error(`${parsed.error}\n${USAGE}`);
    return 2;
  }
  const { only, dryRun } = parsed;
  const pending = [...fixtures].filter(([fixture, promptId]) =>
    only === null ? !existsSync(recordingPath(promptId, fixture)) : fixture === only,
  );
  if (pending.length === 0) console.log('Nothing to record; name a fixture with --only.');
  if (dryRun) {
    for (const [name, id] of pending) console.log(`would record ${name} -> ${id}`);
    return 0;
  }
  const { keys } = loadKeyPool();
  if (pending.length > 0 && keys.length === 0) {
    console.error('No GEMINI_API_KEY in the environment; nothing recorded.');
    return 1;
  }
  const gateway = defaultGateway();
  for (const [fixture, promptId] of pending) {
    if (!(await recordOne(gateway, fixture, promptId, keys))) return 1;
  }
  return 0;
}

// Imported by the argument tests; only records when run as the entry point.
const entry = process.argv[1];
if (entry !== undefined && pathToFileURL(entry).href === import.meta.url) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
