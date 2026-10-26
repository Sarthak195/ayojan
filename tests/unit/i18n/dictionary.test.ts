import { describe, expect, it } from 'vitest';

import { dictionaryFor, type Area } from '@/i18n/dictionary';
import { isLang, LANGS, otherLang } from '@/i18n/lang';
import { waitPhrase } from '@/i18n/wait';

// Built from a code point so this file does not itself contain the banned character.
const EM_DASH = String.fromCharCode(0x2014);

const AREAS: readonly Area[] = [
  'common',
  'start',
  'form',
  'check',
  'plan',
  'tasks',
  'quotes',
  'change',
  'revision',
  'levers',
  'messages',
  'problems',
];

/** Every leaf as [path, value]; functions are called with sample arguments to get their text. */
function leaves(node: unknown, path: string): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (typeof node === 'function') {
    const text: unknown = Reflect.apply(node, undefined, ['Caterer A', 3]);
    return [[path, typeof text === 'string' ? text : '']];
  }
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node).flatMap(([key, child]) => leaves(child, `${path}.${key}`));
  }
  return [[path, '']];
}

describe('dictionaries', () => {
  it('covers every area in both languages', () => {
    for (const lang of LANGS) {
      expect(Object.keys(dictionaryFor(lang)).sort()).toEqual([...AREAS].sort());
    }
  });

  it.each(AREAS)('has the same keys in English and Hindi for %s', (area) => {
    const english = leaves(dictionaryFor('en')[area], area).map(([path]) => path);
    const hindi = leaves(dictionaryFor('hi')[area], area).map(([path]) => path);
    expect(hindi).toEqual(english);
  });

  it.each(AREAS)('has no empty text and no em dash in %s', (area) => {
    for (const lang of LANGS) {
      for (const [path, text] of leaves(dictionaryFor(lang)[area], area)) {
        expect(text.trim(), `${lang} ${path}`).not.toBe('');
        expect(text.includes(EM_DASH), `${lang} ${path}`).toBe(false);
      }
    }
  });

  it('keeps the claims that must stay true word for word (D27, D39, D06, D16)', () => {
    const en = dictionaryFor('en');
    expect(en.common.privacyFooter).toBe(
      'We keep no database. Your plan is encrypted inside the link; Google Cloud request logs may hold the link.',
    );
    expect(en.problems.linkFull.body).toBe(
      "This plan's link is full; undo a step or start a new plan.",
    );
    expect(en.problems.opCap.body).toBe(
      'This plan has reached 40 steps; undo a step or start a new plan.',
    );
    expect(en.common.readingHint).toBe('Reading can take up to 40 seconds.');
    expect(en.common.privacyHint).toBe(
      "Gemini's free tier may use what you send to improve Google's products, so leave out names and phone numbers.",
    );
  });

  it('writes Hindi in Devanagari, not English left untranslated', () => {
    const hi = dictionaryFor('hi');
    expect(hi.common.privacyFooter).toMatch(/[ऀ-ॿ]/);
    expect(hi.problems.linkFull.body).toMatch(/[ऀ-ॿ]/);
  });
});

describe('language helpers', () => {
  it('accepts only the two path languages', () => {
    expect(isLang('en')).toBe(true);
    expect(isLang('hi')).toBe(true);
    for (const value of ['EN', 'fr', '', 'en/', null, 1]) expect(isLang(value)).toBe(false);
    expect(otherLang('en')).toBe('hi');
    expect(otherLang('hi')).toBe('en');
  });
});

describe('waitPhrase', () => {
  const words = dictionaryFor('en').problems.wait;

  it.each([
    [0, '1 second'],
    [1, '1 second'],
    [59, '59 seconds'],
    [60, '1 minute'],
    [61, '2 minutes'],
    [3599, '60 minutes'],
    [3600, '1 hour'],
    [3601, '2 hours'],
  ])('rounds %i seconds up to %s', (seconds, phrase) => {
    expect(waitPhrase(seconds, words)).toBe(phrase);
  });

  it('speaks Hindi units on the Hindi page', () => {
    expect(waitPhrase(120, dictionaryFor('hi').problems.wait)).toBe('2 मिनट');
  });
});
