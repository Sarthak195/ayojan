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
    ['to', 'do to teen lakh'],
    ['to before sau', 'do to teen sau log'],
    ['yaa', 'do yaa teen lakh'],
    ['ya fir', 'teen ya fir chaar lakh'],
    ['ya phir', 'do ya phir teen lakh'],
    ['athva', 'do athva teen lakh'],
    ['two hyphens', 'do--teen lakh'],
    ['spaced hyphens', 'do - - teen lakh'],
    ['em dash', `do${String.fromCharCode(0x2014)}teen lakh`],
    ['minus sign', `do${String.fromCharCode(0x2212)}teen lakh`],
    ['Unicode hyphen', `do${String.fromCharCode(0x2010)}teen lakh`],
    ['tilde', 'do~teen lakh'],
    ['an unread near end', 'pachees-tees hazaar'],
    ['an unread near end and a blank', 'pachees tees hazaar'],
    ['an unread Devanagari near end', 'पच्चीस-तीस हज़ार'],
    ['an unread thirty-five', 'paintees-chalis hazaar'],
    ['an unread eleven before sau', 'gyarah-bees sau'],
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
    // A label before a dash is a list item, not the near end of a range.
    expect(parseAmount('venue - do lakh')).toEqual({ kind: 'amount', inr: 200_000 });
  });

  it('never reads an unread number word as a figure', () => {
    expect(amountsIn('pachees log aayenge')).toEqual([]);
    expect(amountsIn('budget pachees-tees hazaar')).toEqual([]);
    expect(parseAmount('pachpan saath hazaar')).toEqual({ kind: 'unclear', reason: 'no-amount' });
  });
});
