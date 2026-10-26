import { describe, expect, it } from 'vitest';

import { dictionaryFor } from '@/i18n/dictionary';

// The slack a task row and a delay sentence show, in the words a family uses (D40).
describe('slack words', () => {
  it.each<[number, string, string]>([
    [-56, '56 days late', '56 दिन की देरी'],
    [-1, '1 day late', '1 दिन की देरी'],
    [0, 'no days to spare', 'कोई गुंजाइश नहीं'],
    [1, '1 day to spare', '1 दिन की गुंजाइश'],
    [12, '12 days to spare', '12 दिन की गुंजाइश'],
  ])('says %i days of slack as "%s" and "%s"', (days, en, hi) => {
    expect(dictionaryFor('en').plan.slack(days)).toBe(en);
    expect(dictionaryFor('hi').plan.slack(days)).toBe(hi);
  });

  it('never shows a minus sign or the word slack', () => {
    for (const days of [-30, -1, 0, 1, 30]) {
      expect(dictionaryFor('en').plan.slack(days)).not.toMatch(/-|slack/);
      expect(dictionaryFor('hi').plan.slack(days)).not.toMatch(/-/);
    }
  });

  it('uses the same words in a delay sentence, with one day said as one day', () => {
    expect(dictionaryFor('en').tasks.moved('Book the caterer', 1, 'Book the venue', -3)).toBe(
      'Book the caterer: moved 1 day later because Book the venue was delayed; now 3 days late',
    );
    expect(dictionaryFor('hi').tasks.moved('केटरर बुक करें', 4, 'वेन्यू बुक करें', 9)).toBe(
      'केटरर बुक करें: 4 दिन आगे खिसका, क्योंकि वेन्यू बुक करें में देर हुई; अब 9 दिन की गुंजाइश',
    );
  });
});
