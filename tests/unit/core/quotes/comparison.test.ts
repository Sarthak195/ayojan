import { describe, expect, it } from 'vitest';

import type { QuoteRecord } from '@/schemas/plan/quote-record';

import { compareQuotes, ROW_ORDER } from '@/core/quotes/comparison';
import type { Comparison, ComparisonRow } from '@/core/quotes/comparison';
import { rowHeading, UNCONFIRMED_UNTIL_BOOKED } from '@/core/quotes/quote-wording';

import { splitFor } from '../budget/draft-data';
import { CATERER_A, CATERER_B, LIVE_COUNTER_NEEDED, NO_NEEDS, quote } from './quote-data';

const cateringSplit = splitFor().lines.catering.allocation;

function build(quotes: readonly QuoteRecord[], guests = 200, needs = NO_NEEDS): Comparison {
  const result = compareQuotes({
    category: 'catering',
    quotes,
    guests,
    requirements: needs,
    allocation: cateringSplit,
  });
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

function row<K extends ComparisonRow['key']>(
  comparison: Comparison,
  key: K,
): Extract<ComparisonRow, { key: K }> {
  const found = comparison.rows.find((candidate) => candidate.key === key);
  if (found?.key !== key) throw new Error(`No ${key} row`);
  return found as Extract<ComparisonRow, { key: K }>;
}

describe('compareQuotes for the spec quotes at 200 guests', () => {
  const comparison = build([CATERER_B, CATERER_A]);

  it('has the explainer headings first, then the total and the gap, in this order', () => {
    expect(comparison.rows.map((entry) => entry.key)).toEqual([...ROW_ORDER]);
    expect(ROW_ORDER.map((key) => rowHeading(key, 200, 'en'))).toEqual([
      'What is included',
      'How many guests are covered',
      'Additional charges',
      'What still needs clarification',
      'Comparable total at 200 guests',
      'Against your split',
    ]);
  });

  it('has no before-advance row', () => {
    expect(comparison.rows).toHaveLength(6);
  });

  it('orders the columns by slot and marks each unconfirmed until booked', () => {
    expect(comparison.columns).toEqual([
      { quoteId: 'A', unconfirmed: true },
      { quoteId: 'B', unconfirmed: true },
    ]);
    expect(UNCONFIRMED_UNTIL_BOOKED.en).toBe('Unconfirmed until you book');
    expect(UNCONFIRMED_UNTIL_BOOKED.hi).toMatch(/[ऀ-ॿ]/);
  });

  it('shows the totals of Rs 2,60,000 and Rs 3,00,000 and ranks A first', () => {
    const totals = row(comparison, 'comparableTotal').cells.map((cell) =>
      cell.status === 'comparable' ? cell.total.inr : null,
    );
    expect(totals).toEqual([260_000, 300_000]);
    expect(comparison.ranking).toEqual(['A', 'B']);
  });

  it('measures each total against the catering split, negative when under it', () => {
    const gaps = row(comparison, 'againstSplit').cells.map((cell) => cell?.inr);
    expect(gaps).toEqual([260_000 - cateringSplit.inr, 300_000 - cateringSplit.inr]);
    expect(gaps.every((gap) => gap !== undefined && gap < 0)).toBe(true);
  });

  it('describes the guests each quote covers', () => {
    expect(row(comparison, 'guestsCovered').cells).toEqual([
      { kind: 'per-plate', minimumPlates: 200 },
      { kind: 'up-to', guests: 250 },
    ]);
  });

  it('lists the additional charges, with the unstated GST and the uncounted live counter', () => {
    const [a, b] = row(comparison, 'additionalCharges').cells;
    expect(a?.tax).toBe('rate-not-stated');
    expect(a?.advancePercent).toBe(30);
    expect(a?.extras[0]).toMatchObject({ key: 'liveCounter', counted: false });
    expect(b?.tax).toBe('included');
  });

  it('lists what still needs clarification, including the unstated GST on A', () => {
    const [a, b] = row(comparison, 'needsClarification').cells;
    expect(a?.gaps).toEqual(['rateAboveMinimum', 'taxRate']);
    expect(b?.gaps).toEqual([]);
  });

  it('carries the inclusions the vendor listed', () => {
    expect(row(comparison, 'included').cells[0]).toEqual(['2 sweets']);
  });

  it('carries the break-even for the pair', () => {
    expect(comparison.breakEvens).toHaveLength(1);
    expect(comparison.breakEvens[0]).toMatchObject({ above: { cheaper: 'B', fromGuests: 231 } });
  });

  it('claims nothing about availability or confirmation anywhere', () => {
    expect(JSON.stringify(comparison.rows)).not.toMatch(/confirmed|available|booked/i);
  });
});

describe('compareQuotes after the guest count changes', () => {
  it('flips the ranking to B at 250 guests, where A costs Rs 3,25,000', () => {
    const comparison = build([CATERER_A, CATERER_B], 250);
    expect(comparison.ranking).toEqual(['B', 'A']);
    expect(row(comparison, 'comparableTotal').cells.map((cell) => cell.status)).toEqual([
      'comparable',
      'comparable',
    ]);
  });

  it('shows a lump sum over its cap as needing a new quote, with no gap against the split', () => {
    const comparison = build([CATERER_A, CATERER_B], 260);
    expect(row(comparison, 'needsClarification').cells[1]).toEqual({
      gaps: [],
      capExceededAt: 250,
    });
    expect(row(comparison, 'againstSplit').cells[1]).toBeNull();
    expect(comparison.ranking).toEqual(['A']);
  });
});

describe('compareQuotes with few or many quotes', () => {
  it('gives one quote no ranking to show and no break-even', () => {
    const comparison = build([CATERER_A]);
    expect(comparison.ranking).toEqual(['A']);
    expect(comparison.breakEvens).toEqual([]);
  });

  it('gives no quotes empty columns and no rows of cells', () => {
    const comparison = build([]);
    expect(comparison.columns).toEqual([]);
    expect(comparison.rows.every((entry) => entry.cells.length === 0)).toBe(true);
  });

  it('holds six quotes and every column says unconfirmed', () => {
    const six = (['A', 'B', 'C', 'D', 'E', 'F'] as const).map((id, index) =>
      quote({ id, rateInr: 1_000 + index * 100 }),
    );
    const comparison = build(six);
    expect(comparison.columns).toHaveLength(6);
    expect(comparison.columns.map((column) => column.unconfirmed)).toEqual(
      Array<boolean>(6).fill(true),
    );
    expect(comparison.ranking).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('compares only the quotes of the asked category', () => {
    const decor = quote({ id: 'C', category: 'decor', basis: 'lumpSum', rateInr: 40_000 });
    const comparison = build([CATERER_A, decor]);
    expect(comparison.columns.map((column) => column.quoteId)).toEqual(['A']);
  });

  it('flags a quote whose tax is unclear on its own column', () => {
    const comparison = build([quote({ id: 'A', tax: 'unclear' }), CATERER_B]);
    expect(row(comparison, 'needsClarification').cells[0]?.gaps).toContain('taxRate');
    expect(row(comparison, 'additionalCharges').cells[0]?.tax).toBe('unclear');
  });

  it('adds a required live counter to the total it compares', () => {
    const comparison = build([CATERER_A, CATERER_B], 200, LIVE_COUNTER_NEEDED);
    const totals = row(comparison, 'comparableTotal').cells.map((cell) =>
      cell.status === 'comparable' ? cell.total.inr : null,
    );
    expect(totals).toEqual([275_000, 315_000]);
  });

  it('describes a per-day quote as unknown cover and an unclear total', () => {
    const comparison = build([quote({ basis: 'perDay' })]);
    expect(row(comparison, 'guestsCovered').cells).toEqual([{ kind: 'unknown' }]);
    expect(row(comparison, 'needsClarification').cells[0]?.gaps).toContain('days');
    expect(comparison.ranking).toEqual([]);
  });

  it('describes a lump sum with no stated cover as not stated', () => {
    const lump = quote({ basis: 'lumpSum', rateInr: 90_000, guestsCovered: null });
    expect(row(build([lump]), 'guestsCovered').cells).toEqual([{ kind: 'not-stated' }]);
  });

  it('refuses a guest count out of range', () => {
    expect(
      compareQuotes({
        category: 'catering',
        quotes: [CATERER_A],
        guests: 0,
        requirements: NO_NEEDS,
        allocation: cateringSplit,
      }),
    ).toEqual({ ok: false, reason: 'guests-out-of-range' });
  });
});

describe('rowHeading', () => {
  it('words the total row in Hindi with the guest count', () => {
    expect(rowHeading('comparableTotal', 250, 'hi')).toContain('250');
    expect(rowHeading('comparableTotal', 1_200, 'en')).toBe('Comparable total at 1,200 guests');
  });
});
