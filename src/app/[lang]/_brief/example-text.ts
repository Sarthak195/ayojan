import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXAMPLE_FIXTURES } from '@/server/pipeline/example-readings';

let cached: string | null | undefined;

/**
 * The sample brief, exactly as committed. The start page posts these bytes unchanged, so the
 * reader recognises the text and can serve its labelled recording when quota is tight (D18).
 * Null when the file is missing, and the page then offers no example rather than a broken one.
 */
export function exampleBriefText(): string | null {
  if (cached !== undefined) return cached;
  const fixture = EXAMPLE_FIXTURES.find((example) => example.kind === 'brief')?.fixture;
  try {
    cached =
      fixture === undefined
        ? null
        : readFileSync(join(process.cwd(), 'fixtures', `${fixture}.txt`), 'utf8');
  } catch {
    cached = null;
  }
  return cached;
}
