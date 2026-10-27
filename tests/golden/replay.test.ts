// Replays every committed model recording (golden/llm) through its schema and the real read
// pipeline, offline: a fake gateway answers with the recorded reply, so the verification, the
// values rule and the draft check are the production code. Each fixture's planted feature
// (12-requirements section 5.1) is asserted, and the N of M verified count is printed so a prompt
// revision can be judged against the 80 percent floor.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { MessageFactsInput } from '@/core/messages/fact-types';
import { buildMessageFacts } from '@/core/messages/message-facts';
import type { PendingReading } from '@/schemas/plan/state-token';
import { BriefReading } from '@/schemas/readings/brief-reading';
import { ChangeReading } from '@/schemas/readings/change-reading';
import { FamilyUpdateDraft } from '@/schemas/readings/family-update-draft';
import { QuoteReading } from '@/schemas/readings/quote-reading';
import { knowledge } from '@/server/knowledge/repository';
import { draftFamilyUpdate } from '@/server/pipeline/draft-family-update';
import { createExampleBook, RecordingFile } from '@/server/pipeline/example-readings';
import type { LlmGateway } from '@/server/pipeline/llm-gateway';
import { readBrief } from '@/server/pipeline/read-brief';
import { readChange } from '@/server/pipeline/read-change';
import { readQuote } from '@/server/pipeline/read-quote';
import type { ReadingOutcome } from '@/server/pipeline/reading-outcome';
import { SCHEMA_VERSIONS } from '@/server/pipeline/schema-versions';
import { PROMPTS, type PromptId } from '@/server/prompts/registry';

import { listFixtures, recordingPath, FIXTURES_DIR } from '../../scripts/record-golden';
import { fakeLlmGateway } from '../fakes/llm-gateway';
import { date, TODAY } from '../unit/server/pipeline/readings';

// The plan the change fixtures edit: the spec 5.1 wedding on 26 February 2027.
const EVENT_DATE = date('2027-02-26');
const FLOOR = 0.8;
// The sample texts would otherwise take the example path; replay wants the live-read path.
const NO_EXAMPLES = createExampleBook([]);

const SCHEMAS = {
  brief: BriefReading,
  quote: QuoteReading,
  change: ChangeReading,
  familyUpdate: FamilyUpdateDraft,
} as const;

const QUOTE_FIELD =
  /^(category|basis|rateInr|minimumGuests|guestsCovered|advancePercent|tax|extra\.\d|inclusion\.\d)$/;

const FIXTURES = listFixtures();
const fileOf = (fixture: string, id: PromptId) =>
  join(FIXTURES_DIR, `${fixture}${id === 'familyUpdate' ? '.json' : '.txt'}`);

function recordingOf(fixture: string, id: PromptId): RecordingFile {
  return RecordingFile.parse(JSON.parse(readFileSync(recordingPath(id, fixture), 'utf8')));
}

function replaying(id: PromptId, reply: unknown): LlmGateway {
  const inner = fakeLlmGateway(new Map([[id, { reading: reply }]]));
  // The real gateway runs the caller's check before it caches; the shared fake does not, so the
  // draft check would never run without this.
  return {
    async extract(request) {
      const result = await inner.extract(request);
      if (result.kind !== 'reading' || request.check === undefined) return result;
      const reason = request.check(result.value);
      return reason === undefined
        ? result
        : { kind: 'refused', source: result.source, reason, answeredBy: result.answeredBy };
    },
  };
}

async function replay(fixture: string, id: PromptId): Promise<PendingReading> {
  const text = readFileSync(fileOf(fixture, id), 'utf8');
  const deps = { gateway: replaying(id, recordingOf(fixture, id).reply), examples: NO_EXAMPLES };
  let outcome: ReadingOutcome;
  if (id === 'brief') outcome = await readBrief(deps, { text, today: TODAY });
  else if (id === 'quote') outcome = await readQuote(deps, { text });
  else outcome = await readChange(deps, { text, today: TODAY, eventDate: EVENT_DATE });
  if (outcome.kind !== 'check') throw new Error(`${fixture}: form twin (${outcome.cause})`);
  return outcome.pending;
}

// Vitest hides console output of passing tests; the N of M lines are wanted on every run.
function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

function wrongKind(pending: PendingReading, kind: string): never {
  throw new Error(`expected a ${kind} reading, got ${pending.kind}`);
}

const briefOf = (pending: PendingReading) =>
  pending.kind === 'brief' ? pending.values : wrongKind(pending, 'brief');
const quoteOf = (pending: PendingReading) =>
  pending.kind === 'quote' ? pending.values : wrongKind(pending, 'quote');
const changeOf = (pending: PendingReading) =>
  pending.kind === 'change' ? pending.values : wrongKind(pending, 'change');

const statusOf = (pending: PendingReading, field: string) =>
  pending.fields.find((entry) => entry.field === field)?.status;

describe('golden recordings', () => {
  it('has one current recording for every fixture, each valid under its schema', () => {
    expect(FIXTURES.size).toBe(16);
    for (const [fixture, id] of FIXTURES) {
      const recording = recordingOf(fixture, id);
      const prompt = PROMPTS.find((entry) => entry.id === id);
      // A stale recording is silently skipped by the example book; here it fails loudly.
      expect(recording.promptId).toBe(id);
      expect(recording.promptVersion).toBe(prompt?.version);
      expect(recording.schemaVersion).toBe(SCHEMA_VERSIONS[id]);
      expect(SCHEMAS[id].safeParse(recording.reply).success).toBe(true);
    }
  });

  it.each([...FIXTURES].filter(([, id]) => id !== 'familyUpdate'))(
    '%s verifies at least 80 percent of its claims',
    async (fixture, id) => {
      const { readBy } = await replay(fixture, id);
      say(`replay ${fixture}: ${String(readBy.matched)} of ${String(readBy.total)} verified`);
      expect(readBy.total).toBeGreaterThan(0);
      expect(readBy.matched / readBy.total).toBeGreaterThanOrEqual(FLOOR);
    },
  );
});

describe('planted features of the briefs', () => {
  it('brief-hinglish: values beside quotes, the vague date asked, unmentioned functions unsure', async () => {
    const pending = await replay('brief-hinglish', 'brief');
    const values = briefOf(pending);
    expect(values).toMatchObject({ occasion: 'wedding', budgetInr: 800_000, guests: 200 });
    expect(values.eventDate).toBeNull();
    expect(statusOf(pending, 'date')).toBe('unclear');
    expect(values.functions).toEqual({
      haldi: 'yes',
      mehndi: 'yes',
      sangeet: 'unsure',
      wedding: 'unsure',
      reception: 'unsure',
    });
    expect(values.priorities).toMatchObject({ catering: 'more', decor: 'save', venue: 'unclear' });
    expect(values).toMatchObject({ mustHaves: ['dhol'], needs: ['wheelchair'] });
    expect(values).toMatchObject({ diet: ['jain'], venueLimits: ['indoorOnly'] });
    expect(values.notes).toEqual(['DJ chahiye']);
    expect(pending.readBy.matched).toBe(pending.readBy.total);
  });

  it('brief-english: an exact date raises no question and Indian grouping parses', async () => {
    const pending = await replay('brief-english', 'brief');
    const values = briefOf(pending);
    expect(values).toMatchObject({ budgetInr: 800_000, guests: 200, eventDate: '2027-02-26' });
    expect(values.functions).toMatchObject({ sangeet: 'no', wedding: 'yes' });
    expect(pending.fields.every((entry) => entry.status === 'verified')).toBe(true);
  });

  it('brief-hindi: every Devanagari quote verifies, digits and nukta letters included', async () => {
    const pending = await replay('brief-hindi', 'brief');
    const values = briefOf(pending);
    expect(values).toMatchObject({ budgetInr: 800_000, guests: 200, eventDate: '2027-02-26' });
    expect(values).toMatchObject({ mustHaves: ['dhol'], needs: ['wheelchair'] });
    expect(pending.readBy.matched).toBe(pending.readBy.total);
  });

  it('brief-birthday: occasion birthday and a yearless date resolves to the next 12 Dec', async () => {
    const values = briefOf(await replay('brief-birthday', 'brief'));
    expect(values).toMatchObject({ occasion: 'birthday', budgetInr: 200_000, guests: 80 });
    expect(values.eventDate).toBe('2026-12-12');
  });
});

describe('planted features of the quotes', () => {
  it('quote-caterer-a: per plate, minimum, tax extra with no rate, live counter, advance', async () => {
    const pending = await replay('quote-caterer-a', 'quote');
    expect(quoteOf(pending)).toMatchObject({
      category: 'catering',
      basis: 'perPlate',
      rateInr: 1300,
      minimumGuests: 200,
      tax: 'extraRateUnstated',
      taxBasisPoints: null,
      extras: [{ key: 'liveCounter', amountInr: 15_000 }],
      advancePercent: 30,
    });
    expect(pending.readBy.matched).toBe(pending.readBy.total);
  });

  it('quote-caterer-b: a lump sum with a 250 guest cap, tax included', async () => {
    const pending = await replay('quote-caterer-b', 'quote');
    expect(quoteOf(pending)).toMatchObject({
      basis: 'lumpSum',
      rateInr: 300_000,
      guestsCovered: 250,
      minimumGuests: null,
      tax: 'included',
      extras: [{ key: 'liveCounter', amountInr: 15_000 }],
    });
    expect(pending.readBy.matched).toBe(pending.readBy.total);
  });

  it('quote-injection: only the rate is read, and no field can confirm or rank', async () => {
    const pending = await replay('quote-injection', 'quote');
    expect(pending.fields.every((entry) => QUOTE_FIELD.test(entry.field))).toBe(true);
    expect(quoteOf(pending)).toMatchObject({
      category: null,
      basis: 'perPlate',
      rateInr: 1100,
      minimumGuests: null,
      guestsCovered: null,
      advancePercent: null,
      extras: [],
      inclusions: [],
    });
  });

  it.each([
    [
      'quote-over-cap',
      { category: 'catering', basis: 'lumpSum', rateInr: 250_000, guestsCovered: 150 },
    ],
    ['quote-over-budget-venue', { category: 'venue', basis: 'lumpSum', rateInr: 250_000 }],
    ['quote-over-budget-caterer', { category: 'catering', rateInr: 1800, minimumGuests: 200 }],
    ['quote-over-budget-photo', { category: 'photo', basis: 'lumpSum', rateInr: 120_000 }],
  ])('%s: reads the spec 5.3 inputs, tax included', async (fixture, expected) => {
    const values = quoteOf(await replay(fixture, 'quote'));
    expect(values).toMatchObject({ ...expected, tax: 'included' });
  });
});

describe('planted features of the changes', () => {
  it('change-explainer-sentence: +50 guests, 2 weeks earlier, budget down by an unclear amount', async () => {
    const values = changeOf(await replay('change-explainer-sentence', 'change'));
    expect(values.guests).toEqual({ mode: 'delta', count: 50 });
    expect(values.budget).toEqual({
      mode: 'directionOnly',
      direction: 'decrease',
      amountInr: null,
    });
    expect(values.dateCandidates).toEqual(['2027-02-12']);
  });

  it('change-vague-budget: direction only, so the check page asks by how much', async () => {
    const values = changeOf(await replay('change-vague-budget', 'change'));
    expect(values.budget).toEqual({
      mode: 'directionOnly',
      direction: 'decrease',
      amountInr: null,
    });
    expect(values).toMatchObject({ guests: null, dateCandidates: [], reallocate: null });
  });

  it('change-date-conflict: the shift and the written date disagree, so it asks which date', async () => {
    const values = changeOf(await replay('change-date-conflict', 'change'));
    expect(values.dateCandidates).toEqual(['2027-02-12', '2027-03-05']);
  });

  it('change-reallocate-hinglish: 50 hazaar more for photography', async () => {
    const pending = await replay('change-reallocate-hinglish', 'change');
    expect(changeOf(pending).reallocate).toEqual({ to: 'photo', amountInr: 50_000 });
    expect(pending.readBy.matched).toBe(pending.readBy.total);
  });
});

describe('the family-update recording', () => {
  it('passes the draft check against the facts it was written from, or names why not', async () => {
    const raw = readFileSync(fileOf('family-update-facts', 'familyUpdate'), 'utf8');
    const facts = buildMessageFacts(JSON.parse(raw) as MessageFactsInput);
    const reply = recordingOf('family-update-facts', 'familyUpdate').reply;
    const result = await draftFamilyUpdate(replaying('familyUpdate', reply), {
      facts,
      language: 'hi',
      questions: knowledge().all().vendorQuestions.questions,
    });
    say(
      result.kind === 'draft'
        ? `replay family-update-facts: draft, ${result.label}`
        : `replay family-update-facts: template (${result.reasons.join(', ')})`,
    );
    expect(result.kind).toBe('draft');
  });
});
