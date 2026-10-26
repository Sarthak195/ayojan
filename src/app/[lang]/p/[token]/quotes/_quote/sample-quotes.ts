import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXAMPLE_FIXTURES } from '@/server/pipeline/example-readings';

/** The sample quotes the page offers, by a closed id that is safe to put in a link. */
export type SampleId = 'a' | 'b';
export const SAMPLE_IDS: readonly SampleId[] = ['a', 'b'];

const FIXTURE: Readonly<Record<SampleId, string>> = {
  a: 'quote-caterer-a',
  b: 'quote-caterer-b',
};

const cache = new Map<SampleId, string | null>();

/** `?sample=` as a known sample id, or null: the query never carries text, only this id. */
export function sampleIdOf(value: string | string[] | undefined): SampleId | null {
  return SAMPLE_IDS.find((id) => id === value) ?? null;
}

/**
 * A sample quote exactly as committed. Posted unchanged, it matches its recording, so the
 * reader can serve the labelled example when quota is tight (D18); edited, it is read live
 * like any typed text. Null when the file is missing, so the page offers nothing broken.
 */
export function sampleQuoteText(id: SampleId): string | null {
  const known = cache.get(id);
  if (known !== undefined) return known;
  const fixture = EXAMPLE_FIXTURES.find(
    (example) => example.kind === 'quote' && example.fixture === FIXTURE[id],
  )?.fixture;
  let found: string | null = null;
  try {
    found =
      fixture === undefined
        ? null
        : readFileSync(join(process.cwd(), 'fixtures', `${fixture}.txt`), 'utf8');
  } catch {
    found = null;
  }
  cache.set(id, found);
  return found;
}
