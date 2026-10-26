import { describe, expect, it } from 'vitest';

import type { QuoteRecord } from '@/schemas/plan/quote-record';

import { comparableTotal } from '@/core/quotes/comparable-total';
import type { QuoteGap } from '@/core/quotes/quote-types';

import {
  CATERER_A,
  CATERER_B,
  LIVE_COUNTER_NEEDED,
  NO_NEEDS,
  amountOf,
  quote,
  totalOf,
} from './quote-data';

describe('comparableTotal for a per-plate quote', () => {
  // Pinned by hand from the spec (FR-17): Rs 1,300 a plate with a minimum of 200.
  it.each([
    ['pays for the minimum when 150 guests come', 150, 260_000, 200],
    ['charges exactly the minimum at 200 guests', 200, 260_000, 200],
    ['charges every guest above the minimum at 250 guests', 250, 325_000, 250],
    ['charges one plate at a time just above the minimum', 201, 261_300, 201],
  ])('%s', (_name, guests, total, plates) => {
    const result = amountOf(CATERER_A, guests);
    expect(result.total.inr).toBe(total);
    expect(result.billedPlates).toBe(plates);
  });

  it('labels the total as from the quote and keeps the base before tax', () => {
    const result = amountOf(CATERER_A, 200);
    expect(result.total.provenance).toBe('from-quote');
    expect(result.base.inr).toBe(260_000);
    expect(result.beforeTax.inr).toBe(260_000);
  });

  it('asks for the rate above the minimum, but only when a minimum is stated', () => {
    expect(totalOf(CATERER_A, 200).gaps).toContain('rateAboveMinimum');
    expect(totalOf(quote({ minimumGuests: 0 }), 200).gaps).not.toContain('rateAboveMinimum');
  });

  it('prices a missing minimum as no minimum and asks for it', () => {
    const result = amountOf(quote({ minimumGuests: null }), 150);
    expect(result.total.inr).toBe(195_000);
    expect(result.gaps).toContain('minimumGuests');
    expect(result.gaps).not.toContain('rateAboveMinimum');
  });
});

describe('comparableTotal for a lump sum', () => {
  it.each([
    ['within its cap', 200, 'comparable'],
    ['exactly at its cap', 250, 'comparable'],
    ['one guest over its cap', 251, 'cap-exceeded'],
  ] as const)('%s', (_name, guests, status) => {
    const result = totalOf(CATERER_B, guests);
    expect(result.status).toBe(status);
    if (result.status === 'comparable') expect(result.total.inr).toBe(300_000);
  });

  it('never scales a lump sum above its cap and says what the cap was', () => {
    const result = totalOf(CATERER_B, 400);
    expect(result).toMatchObject({ status: 'cap-exceeded', cap: 250, guests: 400 });
    expect(result).not.toHaveProperty('total');
  });

  it('takes the total as quoted when no guests covered is stated, and asks', () => {
    const lump = quote({ id: 'C', basis: 'lumpSum', rateInr: 300_000, guestsCovered: null });
    const result = amountOf(lump, 1_000);
    expect(result.total.inr).toBe(300_000);
    expect(result.gaps).toContain('guestsCovered');
    expect(totalOf(lump, 5_000).status).toBe('comparable');
  });

  it('treats a guests-covered of zero as not stated rather than a cap of zero', () => {
    const lump = quote({ basis: 'lumpSum', rateInr: 90_000, guestsCovered: 0 });
    expect(amountOf(lump, 10).gaps).toContain('guestsCovered');
  });
});

describe('comparableTotal and tax', () => {
  const rows: readonly [string, Partial<QuoteRecord>, number, string, boolean][] = [
    ['leaves an included tax as it is', { tax: 'included' }, 260_000, 'included', false],
    [
      'adds 18 percent when the rate is stated as 1800 basis points',
      { tax: 'extraWithRate', taxBasisPoints: 1_800 },
      306_800,
      'added',
      false,
    ],
    [
      'shows the total without tax when the rate is not stated',
      { tax: 'extraRateUnstated' },
      260_000,
      'rate-not-stated',
      true,
    ],
    ['never assumes a rate for unclear tax', { tax: 'unclear' }, 260_000, 'unclear', true],
    [
      'treats a quote that never mentions tax like an unclear one',
      { tax: 'absent' },
      260_000,
      'unclear',
      true,
    ],
    [
      'does not invent a rate when the tax is extra but the rate is missing',
      { tax: 'extraWithRate', taxBasisPoints: null },
      260_000,
      'unclear',
      true,
    ],
  ];

  it.each(rows)('%s', (_name, overrides, total, kind, flagged) => {
    const result = amountOf(quote(overrides), 200);
    expect(result.total.inr).toBe(total);
    expect(result.tax.kind).toBe(kind);
    expect(result.plusGstRateNotStated).toBe(flagged);
    expect(result.gaps.includes('taxRate')).toBe(flagged);
  });

  it('rounds the added tax half up to a whole rupee', () => {
    // Pinned by hand: 25 x 1800 / 10000 = 4.5, which rounds up to 5.
    const result = amountOf(
      quote({
        basis: 'lumpSum',
        rateInr: 25,
        guestsCovered: 10,
        tax: 'extraWithRate',
        taxBasisPoints: 1_800,
      }),
      5,
    );
    expect(result.tax.amount?.inr).toBe(5);
    expect(result.total.inr).toBe(30);
  });

  it('taxes the extras the plan requires along with the base', () => {
    const taxed = quote({
      tax: 'extraWithRate',
      taxBasisPoints: 1_800,
      extras: CATERER_A.extras,
    });
    // (2,60,000 + 15,000) x 1.18
    expect(amountOf(taxed, 200, LIVE_COUNTER_NEEDED).total.inr).toBe(324_500);
  });
});

describe('comparableTotal and the extras the plan requires', () => {
  it('adds a priced live counter when it is a must-have', () => {
    const result = amountOf(CATERER_A, 200, LIVE_COUNTER_NEEDED);
    expect(result.total.inr).toBe(275_000);
    expect(result.extras).toEqual([
      { key: 'liveCounter', label: 'Live chaat counter', amount: expect.anything(), counted: true },
    ]);
    expect(result.gaps).not.toContain('liveCounter');
  });

  it('shows the live counter without charging it when it is not a must-have', () => {
    const result = amountOf(CATERER_A, 200, NO_NEEDS);
    expect(result.total.inr).toBe(260_000);
    expect(result.extras[0]?.counted).toBe(false);
  });

  it('asks about the counter when it is required and the quote does not price one', () => {
    expect(totalOf(quote({}), 200, LIVE_COUNTER_NEEDED).gaps).toContain('liveCounter');
    const unpriced = quote({ extras: [{ key: 'liveCounter', label: 'Chaat', amountInr: null }] });
    expect(totalOf(unpriced, 200, LIVE_COUNTER_NEEDED).gaps).toContain('liveCounter');
  });

  it('never adds an extra that is not a live counter', () => {
    const other = quote({ extras: [{ key: 'other', label: 'Mocktails', amountInr: 9_000 }] });
    expect(amountOf(other, 200, LIVE_COUNTER_NEEDED).total.inr).toBe(260_000);
  });

  it('ignores a live counter on a quote that is not a caterer', () => {
    const decor = quote({
      category: 'decor',
      basis: 'lumpSum',
      rateInr: 50_000,
      extras: CATERER_A.extras,
    });
    const result = amountOf(decor, 200, LIVE_COUNTER_NEEDED);
    expect(result.total.inr).toBe(50_000);
    expect(result.gaps).not.toContain('liveCounter');
  });
});

describe('comparableTotal when the total cannot be known', () => {
  const rows: readonly [string, Partial<QuoteRecord>, readonly QuoteGap[]][] = [
    ['a per-day quote asks for how many days', { basis: 'perDay' }, ['days']],
    ['an unclear basis asks for the basis', { basis: 'unclear' }, ['basis']],
    ['a missing per-plate rate asks for the rate', { rateInr: null }, ['rate']],
    ['a rate of zero is not a free vendor', { rateInr: 0 }, ['rate']],
    ['a missing lump sum asks for the amount', { basis: 'lumpSum', rateInr: null }, ['rate']],
  ];

  it.each(rows)('%s', (_name, overrides, gaps) => {
    const result = totalOf(quote(overrides), 200);
    expect(result.status).toBe('unclear');
    expect(result.gaps).toEqual(gaps);
    expect(result).not.toHaveProperty('total');
  });

  it('keeps asking about tax on a quote whose total is unclear', () => {
    const result = totalOf(quote({ basis: 'perDay', tax: 'extraRateUnstated' }), 200);
    expect(result.gaps).toEqual(['days', 'taxRate']);
  });
});

describe('comparableTotal edge cases', () => {
  it.each([0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %s guests with a typed reason',
    (guests) => {
      expect(comparableTotal(CATERER_A, guests, NO_NEEDS)).toEqual({
        ok: false,
        reason: 'guests-out-of-range',
      });
    },
  );

  it('stays an exact integer for a very large rate times a large party', () => {
    const big = quote({ rateInr: 1_000_000_000, minimumGuests: null });
    expect(amountOf(big, 5_000).total.inr).toBe(5_000_000_000_000);
  });

  it('refuses a total that would pass the safe-integer range', () => {
    const huge = quote({ rateInr: 10_000_000_000_000 });
    expect(comparableTotal(huge, 5_000, NO_NEEDS)).toEqual({ ok: false, reason: 'out-of-range' });
  });

  it('refuses a stored amount that is not a safe integer', () => {
    const broken = quote({ rateInr: Number.MAX_SAFE_INTEGER + 2 });
    expect(comparableTotal(broken, 10, NO_NEEDS).ok).toBe(false);
  });

  it('gives the same answer twice for the same inputs', () => {
    expect(comparableTotal(CATERER_A, 231, NO_NEEDS)).toEqual(
      comparableTotal(CATERER_A, 231, NO_NEEDS),
    );
  });
});
