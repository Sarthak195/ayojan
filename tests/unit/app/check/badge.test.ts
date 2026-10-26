import { describe, expect, it } from 'vitest';

import { badgeOf } from '@/app/[lang]/p/[token]/check/read-list';
import type { FieldVerdict } from '@/schemas/plan/state-token';

function verdict(status: FieldVerdict['status'], reason: FieldVerdict['reason']): FieldVerdict {
  return { field: 'guests', status, reason, displayQuote: '0 guests' };
}

// The matrix found "0 guests" and "10 October 2026" badged "Not found in your words" right
// under the very words; the badge now tells a missing quote from a value that needs an answer.
describe('the badge under a read value', () => {
  it.each<[FieldVerdict['reason'], string, string]>([
    [
      'out-of-bounds',
      'In your words, but needs your answer',
      'आपके शब्दों में है, पर आपका जवाब चाहिए',
    ],
    [
      'number-not-in-quote',
      'In your words, but this number is not',
      'शब्द आपके हैं, पर यह संख्या उनमें नहीं है',
    ],
    ['quote-not-found', 'Not found in your words', 'आपके शब्दों में नहीं मिला'],
    ['quote-too-long', 'Not found in your words', 'आपके शब्दों में नहीं मिला'],
  ])('words an unverified value with reason %s', (reason, en, hi) => {
    expect(badgeOf(verdict('unverified', reason), 'en')).toBe(en);
    expect(badgeOf(verdict('unverified', reason), 'hi')).toBe(hi);
  });

  it('keeps the plain status word for every other verdict', () => {
    expect(badgeOf(verdict('verified', null), 'en')).toBe('Matched your words');
    expect(badgeOf(verdict('unclear', null), 'en')).toBe('Not clear');
  });
});
