import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXAMPLE_FIXTURES } from '@/server/pipeline/example-readings';

const cached = new Map<'brief' | 'change', string | null>();

/**
 * The first sample of a kind, exactly as committed. A page posts these bytes unchanged, so the
 * reader recognises the text and can serve its labelled recording when quota is tight (D18).
 * Null when the file is missing, and the page then offers no example rather than a broken one.
 */
export function exampleText(kind: 'brief' | 'change'): string | null {
  const known = cached.get(kind);
  if (known !== undefined) return known;
  const fixture = EXAMPLE_FIXTURES.find((example) => example.kind === kind)?.fixture;
  let text: string | null;
  try {
    text =
      fixture === undefined
        ? null
        : readFileSync(join(process.cwd(), 'fixtures', `${fixture}.txt`), 'utf8');
  } catch {
    text = null;
  }
  cached.set(kind, text);
  return text;
}

/** The start page's sample brief. */
export function exampleBriefText(): string | null {
  return exampleText('brief');
}
