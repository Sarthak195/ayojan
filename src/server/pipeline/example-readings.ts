import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { canonicalise } from '@/core/grounding/canonical-text';
import { IsoDate } from '@/schemas/plan/brief';
import * as brief from '@/server/prompts/brief';
import * as change from '@/server/prompts/change';
import * as quote from '@/server/prompts/quote';

import { SCHEMA_VERSIONS, type ReadingKind } from './schema-versions';

/**
 * The sample texts the start, quotes and plan pages offer (D18): the sample brief, the two
 * sample quotes and the explainer's change sentence. Each has a text in `fixtures/` and one
 * committed recording in `golden/llm/`.
 */
export const EXAMPLE_FIXTURES: readonly { readonly kind: ReadingKind; readonly fixture: string }[] =
  [
    { kind: 'brief', fixture: 'brief-hinglish' },
    { kind: 'quote', fixture: 'quote-caterer-a' },
    { kind: 'quote', fixture: 'quote-caterer-b' },
    { kind: 'change', fixture: 'change-explainer-sentence' },
  ];

const PROMPTS: Readonly<Record<ReadingKind, { readonly id: string; readonly version: number }>> = {
  brief,
  quote,
  change,
};

/**
 * What scripts/record-golden.ts writes to `golden/llm/<fixture>.<promptId>.json`. Extra keys
 * are ignored; the reply is parsed by the reader's own schema before it is served.
 */
export const RecordingFile = z.object({
  promptId: z.string(),
  promptVersion: z.number().int(),
  schemaVersion: z.string(),
  answeredBy: z.string().max(40),
  recordedOn: IsoDate,
  reply: z.unknown(),
});
export type RecordingFile = z.infer<typeof RecordingFile>;

export interface Example {
  readonly kind: ReadingKind;
  /** The canonical spelling of the sample text: a read matches on this, never on raw bytes. */
  readonly canonicalText: string;
  readonly recording: RecordingFile;
}

export interface ExampleMatch {
  readonly reply: unknown;
  readonly answeredBy: string;
  readonly recordedOn: string;
}

export interface ExampleBook {
  /** The recording for exactly this sample text, or undefined for text the user typed. */
  find(kind: ReadingKind, canonicalText: string): ExampleMatch | undefined;
  /** The newest recording date of a kind, for the label on a page that no longer has the text. */
  recordedOn(kind: ReadingKind): string | undefined;
}

// A recording made for another prompt or schema version would answer a question that is no
// longer asked; a live call (or the form) is more honest than serving it.
function isCurrent(kind: ReadingKind, recording: RecordingFile): boolean {
  const prompt = PROMPTS[kind];
  return (
    recording.promptId === prompt.id &&
    recording.promptVersion === prompt.version &&
    recording.schemaVersion === SCHEMA_VERSIONS[kind]
  );
}

export function createExampleBook(examples: readonly Example[]): ExampleBook {
  const current = examples.filter((example) => isCurrent(example.kind, example.recording));
  return {
    find(kind, canonicalText) {
      const hit = current.find(
        (example) => example.kind === kind && example.canonicalText === canonicalText,
      );
      if (hit === undefined) return undefined;
      const { reply, answeredBy, recordedOn } = hit.recording;
      return { reply, answeredBy, recordedOn };
    },
    recordedOn(kind) {
      const dates = current
        .filter((example) => example.kind === kind)
        .map((example) => example.recording.recordedOn)
        .sort();
      return dates.at(-1);
    },
  };
}

/** Reads one file relative to the repository root, or undefined when it is not there. */
export type ReadRepoText = (relativePath: string) => string | undefined;

function readFromRoot(root: string): ReadRepoText {
  return (relativePath) => {
    try {
      return readFileSync(join(root, relativePath), 'utf8');
    } catch {
      // A missing fixture or recording means that sample is read live like typed text.
      return undefined;
    }
  };
}

function parseRecording(text: string | undefined): RecordingFile | undefined {
  if (text === undefined) return undefined;
  try {
    const parsed = RecordingFile.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Loads every sample whose text and recording are both present and well formed. */
export function loadExamples(read: ReadRepoText): Example[] {
  const examples: Example[] = [];
  for (const { kind, fixture } of EXAMPLE_FIXTURES) {
    const text = read(`fixtures/${fixture}.txt`);
    const recording = parseRecording(read(`golden/llm/${fixture}.${PROMPTS[kind].id}.json`));
    if (text !== undefined && recording !== undefined) {
      examples.push({ kind, canonicalText: canonicalise(text).text, recording });
    }
  }
  return examples;
}

const HOLDER = Symbol.for('ayojan.exampleBook');
type BookHolder = typeof globalThis & { [HOLDER]?: ExampleBook };

/** The process-wide book over the committed files, loaded on first use. */
export function exampleBook(): ExampleBook {
  const holder: BookHolder = globalThis;
  const existing = holder[HOLDER];
  if (existing !== undefined) return existing;
  const created = createExampleBook(loadExamples(readFromRoot(process.cwd())));
  holder[HOLDER] = created;
  return created;
}

/** The D18 label, word for word, so an example is never mistaken for a live read. */
export function exampleLabel(recordedOn: string): string {
  return `Example reading, recorded on ${recordedOn}; your own words are read live`;
}
