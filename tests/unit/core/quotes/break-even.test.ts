import { describe, expect, it } from 'vitest';

import type { QuoteRecord } from '@/schemas/plan/quote-record';

import type { BreakEven } from '@/core/quotes/break-even';
import { breakEven, breakEvenAll } from '@/core/quotes/break-even';
import { breakEvenSentence, quoteLabel } from '@/core/quotes/quote-wording';

import { CATERER_A, CATERER_B, NO_NEEDS, quote } from './quote-data';

function compare(pair: readonly [QuoteRecord, QuoteRecord], guests: number): BreakEven {
  const result = breakEven(pair, guests, NO_NEEDS);
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

function compared(pair: readonly [QuoteRecord, QuoteRecord], guests: number) {
  const result = compare(pair, guests);
  if (result.kind !== 'compared') throw new Error(`Not compared: ${result.kind}`);
  return result;
}

function english(result: BreakEven) {
  const labels: Record<string, QuoteRecord> = { A: CATERER_A, B: CATERER_B };
  return breakEvenSentence(result, (slot) => quoteLabel(labels[slot] ?? CATERER_A, 'en'), 'en');
}

describe('breakEven for the spec quotes at 200 guests', () => {
  const result = compared([CATERER_A, CATERER_B], 200);

  it('finds 231 as the first count where A at Rs 1,300 a plate passes Rs 3,00,000', () => {
    expect(result.cheaperNow).toBe('A');
    expect(result.above).toEqual({ cheaper: 'B', fromGuests: 231 });
    expect(result.below).toBeNull();
  });

  it('stops the scan at the lump sum cap and says the comparison ends there', () => {
    expect(result.scannedTo).toBe(250);
    expect(result.capEnd).toEqual({ quote: 'B', cap: 250 });
  });

  it('notes that A leaves out a GST whose rate is not stated', () => {
    expect(result.beforeGstOf).toEqual(['A']);
  });

  it('reads as the pinned sentence, with the cap said separately', () => {
    expect(english(result)).toEqual({
      headline: "Caterer B becomes cheaper from 231 guests, before Caterer A's GST.",
      capNote: 'Caterer B covers up to 250 guests, so the comparison ends there.',
    });
  });

  it('reads in Hindi with the same numbers', () => {
    const labels = (slot: string): string =>
      quoteLabel(quote({ id: slot === 'A' ? 'A' : 'B' }), 'hi');
    const hindi = breakEvenSentence(result, labels, 'hi');
    expect(hindi.headline).toContain('231');
    expect(hindi.headline).toMatch(/[ऀ-ॿ]/);
    expect(hindi.capNote).toContain('250');
  });
});

describe('breakEven rates and counts', () => {
  it.each([
    ['the video rate of Rs 1,350 a plate', 1_350, 223],
    ['Rs 1,300 a plate', 1_300, 231],
  ])('with %s the first flip is at %s', (_name, rate, from) => {
    const result = compared([quote({ ...CATERER_A, rateInr: rate }), CATERER_B], 200);
    expect(result.above?.fromGuests ?? null).toBe(from);
  });

  it('does not count a tie as the order flipping', () => {
    // 1,200 x 250 equals 3,00,000, so the totals touch at the cap and never swap.
    const result = compared([quote({ ...CATERER_A, rateInr: 1_200 }), CATERER_B], 200);
    expect(result.above).toBeNull();
  });
});

describe('breakEven when the flip has already happened', () => {
  const result = compared([CATERER_A, CATERER_B], 231);

  it('knows B is cheaper now and that A was cheaper below this count', () => {
    expect(result.cheaperNow).toBe('B');
    expect(result.above).toBeNull();
    expect(result.below).toEqual({ cheaper: 'A', belowGuests: 231 });
  });

  it('words it as from now on', () => {
    expect(english(result).headline).toBe(
      "Caterer B is cheaper from now on, from 231 guests, before Caterer A's GST.",
    );
  });
});

describe('breakEven with a crossing below the current count', () => {
  // Pinned by hand: 1,000 a plate with a minimum of 300 costs Rs 3,00,000 up to 300 guests;
  // 1,200 a plate with a minimum of 100 costs 1,200 x g. They meet at 250 guests.
  const first = quote({ id: 'A', rateInr: 1_000, minimumGuests: 300 });
  const second = quote({ id: 'B', rateInr: 1_200, minimumGuests: 100 });

  it('finds where the other quote was cheaper', () => {
    const result = compared([first, second], 300);
    expect(result.cheaperNow).toBe('A');
    expect(result.below).toEqual({ cheaper: 'B', belowGuests: 250 });
    expect(english(result).headline).toBe('Caterer B becomes cheaper below 250 guests.');
  });
});

describe('breakEven with no crossing', () => {
  it('shows no line when the order never flips below the cap', () => {
    const result = compared([quote({ ...CATERER_A, rateInr: 1_000 }), CATERER_B], 200);
    expect(result.above).toBeNull();
    expect(result.below).toBeNull();
    expect(english(result).headline).toBeNull();
  });

  it('stops short of a crossing that lies beyond the cap, and says so', () => {
    // 3,00,000 / 1,100 = 272.7: the crossing is at 273, past the cap of 250.
    const result = compared([quote({ ...CATERER_A, rateInr: 1_100 }), CATERER_B], 200);
    expect(result.above).toBeNull();
    expect(result.capEnd).toEqual({ quote: 'B', cap: 250 });
    expect(english(result).capNote).toContain('250');
  });

  it('never crosses two lump sums', () => {
    const other = quote({ id: 'C', basis: 'lumpSum', rateInr: 280_000, guestsCovered: 300 });
    const result = compared([CATERER_B, other], 200);
    expect(result.cheaperNow).toBe('C');
    expect(result.above).toBeNull();
    expect(result.below).toBeNull();
  });

  it('reports equal totals as a tie with nothing to flip', () => {
    const same = quote({ id: 'C', basis: 'lumpSum', rateInr: 300_000, guestsCovered: 250 });
    const result = compared([CATERER_B, same], 200);
    expect(result.cheaperNow).toBeNull();
    expect(result.above).toBeNull();
    expect(result.below).toBeNull();
  });
});

describe('breakEven scan bounds', () => {
  const flat = quote({ id: 'B', basis: 'lumpSum', rateInr: 10_000_000, guestsCovered: null });

  it('stops at twice the current count', () => {
    const result = compared([quote({ rateInr: 1_000, minimumGuests: null }), flat], 100);
    expect(result.scannedTo).toBe(200);
    expect(result.above).toBeNull();
    expect(result.capEnd).toBeNull();
  });

  it('stops at 5,000 guests', () => {
    const result = compared([quote({ rateInr: 100, minimumGuests: null }), flat], 4_000);
    expect(result.scannedTo).toBe(5_000);
  });

  it('finds a crossing that sits exactly on the last scanned count', () => {
    // A passes Rs 9,900 first at 100 guests, which is twice the current 50 and still scanned.
    const lump = quote({ id: 'B', basis: 'lumpSum', rateInr: 9_900, guestsCovered: null });
    const result = compared([quote({ rateInr: 100, minimumGuests: null }), lump], 50);
    expect(result.above).toEqual({ cheaper: 'B', fromGuests: 100 });
  });

  it('does not report a cap that sits beyond the scan as the reason it ended', () => {
    const far = quote({ id: 'B', basis: 'lumpSum', rateInr: 10_000_000, guestsCovered: 4_000 });
    const result = compared([quote({ rateInr: 1_000, minimumGuests: null }), far], 100);
    expect(result.capEnd).toBeNull();
  });
});

describe('breakEven when a quote has no comparable total', () => {
  it('has no line for an unclear quote and names it', () => {
    const result = compare([quote({ basis: 'perDay' }), CATERER_B], 200);
    expect(result).toEqual({ kind: 'not-comparable', quotes: ['A', 'B'], unavailable: ['A'] });
    expect(english(result)).toEqual({ headline: null, capNote: null });
  });

  it('has no line when a lump sum is already over its cap', () => {
    const result = compare([CATERER_A, CATERER_B], 251);
    expect(result).toMatchObject({ kind: 'not-comparable', unavailable: ['B'] });
  });

  it('refuses a guest count out of range', () => {
    expect(breakEven([CATERER_A, CATERER_B], 0, NO_NEEDS)).toEqual({
      ok: false,
      reason: 'guests-out-of-range',
    });
  });
});

describe('breakEvenAll', () => {
  const third = quote({ id: 'C', rateInr: 1_500, minimumGuests: 150 });

  it('compares three quotes pairwise in slot order', () => {
    const result = breakEvenAll([third, CATERER_B, CATERER_A], 200, NO_NEEDS);
    expect(result.ok && result.value.map((entry) => entry.quotes.join(''))).toEqual([
      'AB',
      'AC',
      'BC',
    ]);
  });

  it('never pairs quotes of different categories', () => {
    const decor = quote({ id: 'C', category: 'decor', basis: 'lumpSum', rateInr: 40_000 });
    const result = breakEvenAll([CATERER_A, CATERER_B, decor], 200, NO_NEEDS);
    expect(result.ok && result.value).toHaveLength(1);
  });

  it('handles six quotes as fifteen pairs', () => {
    const six = (['A', 'B', 'C', 'D', 'E', 'F'] as const).map((id, index) =>
      quote({ id, rateInr: 1_000 + index * 50, minimumGuests: 100 + index * 20 }),
    );
    const result = breakEvenAll(six, 200, NO_NEEDS);
    expect(result.ok && result.value).toHaveLength(15);
  });

  it('gives one quote no pairs', () => {
    const result = breakEvenAll([CATERER_A], 200, NO_NEEDS);
    expect(result.ok && result.value).toEqual([]);
  });
});
