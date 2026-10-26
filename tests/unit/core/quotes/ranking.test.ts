import { describe, expect, it } from 'vitest';

import { cheapestByCategory, rankComparable, totalsFor } from '@/core/quotes/ranking';

import { CATERER_A, CATERER_B, LIVE_COUNTER_NEEDED, NO_NEEDS, quote, totalOf } from './quote-data';

function cheapest(quotes: Parameters<typeof cheapestByCategory>[0], guests: number) {
  const result = cheapestByCategory(quotes, guests, NO_NEEDS);
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

describe('cheapestByCategory', () => {
  it('takes the cheaper comparable quote at 200 guests and flags its unstated GST', () => {
    const found = cheapest([CATERER_A, CATERER_B], 200);
    expect(found.catering).toEqual({ quoteId: 'A', totalInr: 260_000, plusGstRateNotStated: true });
  });

  it('flips to the other caterer at 250 guests, where A costs Rs 3,25,000', () => {
    const found = cheapest([CATERER_A, CATERER_B], 250);
    expect(found.catering).toEqual({
      quoteId: 'B',
      totalInr: 300_000,
      plusGstRateNotStated: false,
    });
  });

  it('leaves out a lump sum above its cap, so the other quote stays the cheapest', () => {
    expect(cheapest([CATERER_A, CATERER_B], 260).catering?.quoteId).toBe('A');
  });

  it('gives a category no entry when every quote is unclear or over its cap', () => {
    const perDay = quote({ id: 'C', basis: 'perDay' });
    expect(cheapest([perDay, CATERER_B], 300).catering).toBeUndefined();
  });

  it('keeps categories apart', () => {
    const decor = quote({ id: 'C', category: 'decor', basis: 'lumpSum', rateInr: 40_000 });
    const found = cheapest([CATERER_A, decor], 200);
    expect(found.catering?.totalInr).toBe(260_000);
    expect(found.decor?.totalInr).toBe(40_000);
  });

  it('breaks a tie by slot order', () => {
    const same = quote({ id: 'B', basis: 'lumpSum', rateInr: 260_000, guestsCovered: 300 });
    expect(cheapest([same, quote({ id: 'A', tax: 'included' })], 200).catering?.quoteId).toBe('A');
  });

  it('adds a required live counter before comparing', () => {
    const result = cheapestByCategory([CATERER_A, CATERER_B], 200, LIVE_COUNTER_NEEDED);
    expect(result.ok && result.value.catering?.totalInr).toBe(275_000);
  });

  it('passes a typed refusal on for a guest count out of range', () => {
    expect(cheapestByCategory([CATERER_A], 0, NO_NEEDS)).toEqual({
      ok: false,
      reason: 'guests-out-of-range',
    });
  });

  it('returns nothing for no quotes', () => {
    expect(cheapest([], 200)).toEqual({});
  });
});

describe('a planted instruction in a quote', () => {
  // The reading holds only a rate of Rs 1,100 (fixtures/quote-injection.txt); there is no
  // field for confirmation or ranking, so the other quotes' totals cannot move.
  const injected = quote({ id: 'C', rateInr: 1_100, tax: 'unclear' });

  it('changes no other quote total', () => {
    const before = totalsFor([CATERER_A, CATERER_B], 200, NO_NEEDS);
    const after = totalsFor([CATERER_A, CATERER_B, injected], 200, NO_NEEDS);
    expect(before.ok && after.ok && after.value.slice(0, 2)).toEqual(before.ok && before.value);
  });

  it('is ranked by its own arithmetic and never marked confirmed', () => {
    const ranked = rankComparable([totalOf(CATERER_A, 200), totalOf(injected, 200)]);
    expect(ranked.map((entry) => entry.quoteId)).toEqual(['C', 'A']);
    expect(JSON.stringify(totalOf(injected, 200))).not.toMatch(/confirm|available/i);
  });
});
