import 'server-only';

import type { z } from 'zod';

import { canonicalise } from '@/core/grounding/canonical-text';
import { PendingReading } from '@/schemas/plan/state-token';
import { log } from '@/server/observability/logger';

import { exampleBook, type ExampleBook } from './example-readings';
import type { LlmGateway, PromptSpec, TextOrigin } from './llm-gateway';
import {
  checkOutcome,
  extractOrForm,
  formOutcome,
  readByOf,
  type ReadingOutcome,
} from './reading-outcome';
import { SCHEMA_VERSIONS, type ReadingKind } from './schema-versions';
import { verdictsFor, type Verdicts } from './verdicts';

export interface ReaderDeps {
  readonly gateway: LlmGateway;
  /** The committed sample recordings (D18); production uses the process-wide book. */
  readonly examples?: ExampleBook;
}

type WithoutCheck<T> = T extends unknown ? Omit<T, 'fields' | 'readBy'> : never;

/** A reader's values for one kind of pending reading; fields and provenance are added here. */
export type PendingValues = WithoutCheck<PendingReading>;

interface ReaderSpec<T> {
  readonly kind: ReadingKind;
  readonly prompt: PromptSpec;
  readonly schema: z.ZodType<T>;
  readonly text: string;
  /** Turns a schema-valid reading into values, recording a verdict for every claim it uses. */
  readonly build: (reading: T, verdicts: Verdicts) => PendingValues;
}

function originFor<T>(
  spec: ReaderSpec<T>,
  examples: ExampleBook,
  canonicalText: string,
): { origin: TextOrigin<T>; answeredBy: string | null; recordedOn: string | null } {
  const match = examples.find(spec.kind, canonicalText);
  const recording = match === undefined ? undefined : spec.schema.safeParse(match.reply);
  if (match === undefined || recording?.success !== true) {
    return { origin: { kind: 'typed' }, answeredBy: null, recordedOn: null };
  }
  return {
    origin: { kind: 'example', recording: recording.data },
    answeredBy: match.answeredBy,
    recordedOn: match.recordedOn,
  };
}

/**
 * The shared path of the three readers: canonicalise the text once, ask the gateway (with the
 * committed recording when the text is exactly a sample), then verify every value against the
 * user's own words. Whatever the model said, the result is a check page or the form twin.
 */
export async function runReader<T>(deps: ReaderDeps, spec: ReaderSpec<T>): Promise<ReadingOutcome> {
  const canonical = canonicalise(spec.text);
  const examples = deps.examples ?? exampleBook();
  const example = originFor(spec, examples, canonical.text);
  const extraction = await extractOrForm(deps.gateway, {
    prompt: spec.prompt,
    schema: spec.schema,
    schemaVersion: SCHEMA_VERSIONS[spec.kind],
    text: canonical.text,
    origin: example.origin,
  });
  if (extraction.kind === 'form') return formOutcome(extraction.cause);
  if (extraction.kind === 'refused') {
    // Readers pass no check of their own, so a refusal here means the wiring is wrong.
    log.error('reading-refused', { promptId: spec.prompt.id });
    return formOutcome('our-bug');
  }

  const verdicts = verdictsFor(canonical);
  const values = spec.build(extraction.value, verdicts);
  const { fields, matched, total } = verdicts.finish();
  const isExample = extraction.source === 'example';
  const readBy = readByOf(extraction.source, extraction.answeredBy ?? example.answeredBy, {
    matched,
    total,
  });
  // The pending reading is sealed into the link next; a shape the token schema refuses is our
  // bug, and it degrades to the form here rather than failing as a 500 at sealing time.
  const pending = PendingReading.safeParse({ ...values, fields, readBy });
  if (!pending.success) {
    log.error('reading-unsealable', { promptId: spec.prompt.id });
    return formOutcome('our-bug');
  }
  return checkOutcome(pending.data, isExample ? example.recordedOn : null);
}
