import { describe, expect, it } from 'vitest';

import { amountsIn, parseAmount, scanAmounts } from '@/core/rupees/parse';

const SEVERAL = { kind: 'unclear', reason: 'several-amounts' };

describe('a bare number word beside an amount is a range, never one figure (D44)', () => {
  it.each([
    ['hyphen', 'do-teen lakh'],
    ['space', 'do teen lakh'],
    ['ya', 'do ya teen lakh'],
    ['se', 'do se teen lakh'],
    ['aur', 'ek aur do lakh'],
    ['or', 'do or teen lakh'],
    ['en dash', 'do\u2013teen lakh'],
    ['slash', 'do/teen lakh'],
    ['a fraction word', 'dedh-do lakh'],
    ['Devanagari', '\u0926\u094B-\u0924\u0940\u0928 \u0932\u093E\u0916'],
    ['Devanagari ya', '\u0926\u094B \u092F\u093E \u0924\u0940\u0928 \u0932\u093E\u0916'],
    ['digits on both ends', '2-3 lakh'],
    ['a word after the amount', 'teen lakh do'],
  ])('%s: %s asks how much', (_name, text) => {
    expect(parseAmount(text)).toEqual(SEVERAL);
  });

  it('leaves no figure for the grounding check to match', () => {
    expect(amountsIn('budget do-teen lakh')).toEqual([]);
    expect(amountsIn('budget do ya teen lakh hai')).toEqual([]);
  });

  it('reports the whole range as one span', () => {
    expect(scanAmounts('budget do-teen lakh')).toEqual([
      { kind: 'unusable', reason: 'several-amounts', start: 7, end: 19 },
    ]);
  });

  it('does not join a number word that other words keep apart', () => {
    expect(parseAmount('do log, teen lakh')).toEqual({ kind: 'amount', inr: 300_000 });
    expect(parseAmount('do din ka function, teen lakh')).toEqual({ kind: 'amount', inr: 300_000 });
    expect(amountsIn('teen lakh, do din')).toEqual([300_000]);
  });
});
