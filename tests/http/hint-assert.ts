import { expect } from 'vitest';

import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

const ENTITIES: Readonly<Record<string, string>> = { '&#x27;': "'", '&amp;': '&', '&quot;': '"' };

function plainText(markup: string): string {
  return markup.replace(/&#x27;|&amp;|&quot;/g, (entity) => ENTITIES[entity] ?? entity);
}

/**
 * D16 and D41: a read button points at a hint through aria-describedby, and that element has to
 * hold both the 40-second sentence and the privacy sentence, or screen readers lose the privacy
 * line while sighted users still see it.
 */
export function expectReadButtonHint(html: string, lang: Lang, hintId: string): void {
  const { common } = dictionaryFor(lang);
  const described = [...html.matchAll(/<button[^>]*aria-describedby="([^"]*)"/g)].flatMap((m) =>
    (m[1] ?? '').split(' '),
  );
  expect(described).toContain(hintId);
  const hint = new RegExp(`<p id="${hintId}"[^>]*>([^<]*)</p>`).exec(html);
  expect(hint).not.toBeNull();
  const text = plainText(hint?.[1] ?? '');
  expect(text).toContain(common.readingHint);
  expect(text).toContain(common.privacyHint);
}
