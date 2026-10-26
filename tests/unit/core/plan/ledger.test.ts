import { describe, expect, it } from 'vitest';

import { ledgerRows } from '@/core/plan/ledger';
import { utf8ByteLength } from '@/schemas/plan/short-text';

import { FORM_READ, PLAN_DATA, SPEC_OPS, briefOp, first, VENUE_BOOKED } from './plan-fixture';

const rows = ledgerRows(SPEC_OPS, PLAN_DATA);

describe('ledger (FR-37)', () => {
  it('lists one row per op, newest first, so Undo removes the top row', () => {
    expect(rows.map((row) => [row.version, row.kind])).toEqual([
      [8, 'changeConfirmed'],
      [7, 'leversApplied'],
      [6, 'changeConfirmed'],
      [5, 'quoteAdded'],
      [4, 'quoteAdded'],
      [3, 'taskDelayed'],
      [2, 'taskDone'],
      [1, 'briefConfirmed'],
    ]);
  });

  // The task and lever names are the data's own words, so these lines change with the data.
  it.each<[number, string]>([
    [
      1,
      'Brief confirmed: Rs 8,00,000, 200 guests, 26 Feb 2027 (read by AI, 9 of 9 values verified)',
    ],
    [2, 'Book the venue marked done, booked at Rs 1,80,000, for 220 guests'],
    [3, 'Book the decorator delayed: not before 10 Nov 2026'],
    [4, 'Quote added: Caterer A (read by AI, 9 of 9 values verified)'],
    [6, 'Change: guests 250, budget Rs 7,50,000, date 12 Feb 2027'],
    [7, 'Trade-offs chosen: E-invites and simpler return gifts; Use half the contingency'],
    [8, 'Change: Rs 40,000 moved to Photo and video, priorities revised'],
  ])('words version %i in English', (version, text) => {
    expect(rows.find((row) => row.version === version)?.en).toBe(text);
  });

  it('words every row in Hindi too, with the same figures', () => {
    for (const row of rows) expect(row.hi.length).toBeGreaterThan(0);
    expect(rows.find((row) => row.version === 6)?.hi).toBe(
      'बदलाव: मेहमान 250, बजट Rs 7,50,000, तारीख़ 12 फ़रवरी 2027',
    );
  });

  it("carries a change row's source quotes, at most three of at most 80 bytes", () => {
    const sources = rows.find((row) => row.version === 6)?.sources ?? [];
    expect(sources).toEqual([
      '50 more guests',
      'our budget has decreased a bit',
      '2 weeks earlier',
    ]);
    for (const source of sources) expect(utf8ByteLength(source)).toBeLessThanOrEqual(80);
  });

  it('says how a reading was taken, and gives task events no reader', () => {
    const formBrief = ledgerRows([{ ...briefOp(), readBy: FORM_READ }], PLAN_DATA)[0];
    expect(formBrief?.en).toContain('(entered by form)');
    expect(ledgerRows([...first(1), VENUE_BOOKED], PLAN_DATA)[0]?.readBy).toBeNull();
  });

  it('names a raise with the rupees agreed', () => {
    const raised = ledgerRows(
      [...first(6), { kind: 'leversApplied', leverIds: ['raise-budget'], raiseBudgetInr: 48_900 }],
      PLAN_DATA,
    )[0];
    expect(raised?.en).toBe('Trade-offs chosen: Raise the budget to cover the gap (Rs 48,900)');
  });
});
