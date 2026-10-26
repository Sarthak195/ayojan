// The guest count where the cheaper of two quotes changes (architecture 4.7, decision D12).
// A bounded integer scan over guest counts, not a piecewise solver: each count is priced with
// the same comparableTotal the table uses, so the break-even cannot disagree with the table.
// Upward the scan runs from the current count to the smaller of the lowest cap, twice the
// count and 5,000; downward it runs to 1. A count at which either quote is capped or unclear
// is skipped, which is how a capped quote leaves the comparison above its cap.

import type { QuoteRecord, QuoteSlot } from '@/schemas/plan/quote-record';

import { comparableTotal } from './comparable-total';
import type { PlanRequirements, QuoteResult } from './quote-types';
import { accepted, refused } from './quote-types';
import { taxIsUnsettled } from './tax';

export const SCAN_CEILING_GUESTS = 5_000;

export interface FlipAbove {
  readonly cheaper: QuoteSlot;
  /** The first guest count, above the current one, at which `cheaper` is the cheaper quote. */
  readonly fromGuests: number;
}

export interface FlipBelow {
  readonly cheaper: QuoteSlot;
  /** `cheaper` wins at every compared count below this one; equal to the current count when
   * the flip has already happened, which the sentence words as "from now on". */
  readonly belowGuests: number;
}

export interface CapEnd {
  readonly quote: QuoteSlot;
  /** The comparison stops above this many guests because the lump sum does not cover more. */
  readonly cap: number;
}

export type BreakEven =
  | {
      readonly kind: 'not-comparable';
      readonly quotes: readonly [QuoteSlot, QuoteSlot];
      /** The quotes with no comparable total at the current count. */
      readonly unavailable: readonly QuoteSlot[];
    }
  | {
      readonly kind: 'compared';
      readonly quotes: readonly [QuoteSlot, QuoteSlot];
      readonly guests: number;
      /** Null when the two totals are equal at the current count. */
      readonly cheaperNow: QuoteSlot | null;
      readonly above: FlipAbove | null;
      readonly below: FlipBelow | null;
      readonly capEnd: CapEnd | null;
      /** Quotes whose total leaves out a tax that may apply, for "before A's GST". */
      readonly beforeGstOf: readonly QuoteSlot[];
      readonly scannedTo: number;
    };

type Order = -1 | 0 | 1;

function totalAt(quote: QuoteRecord, guests: number, needs: PlanRequirements): number | null {
  const total = comparableTotal(quote, guests, needs);
  return total.ok && total.value.status === 'comparable' ? total.value.total.inr : null;
}

function orderAt(
  pair: readonly [QuoteRecord, QuoteRecord],
  guests: number,
  needs: PlanRequirements,
): Order | null {
  const first = totalAt(pair[0], guests, needs);
  const second = totalAt(pair[1], guests, needs);
  if (first === null || second === null) return null;
  return first < second ? -1 : first > second ? 1 : 0;
}

function lowestCap(pair: readonly [QuoteRecord, QuoteRecord]): CapEnd | null {
  let found: CapEnd | null = null;
  for (const quote of pair) {
    const cap = quote.basis === 'lumpSum' ? quote.guestsCovered : null;
    if (cap !== null && cap >= 1 && (found === null || cap < found.cap)) {
      found = { quote: quote.id, cap };
    }
  }
  return found;
}

function cheaperOf(pair: readonly [QuoteRecord, QuoteRecord], order: Order): QuoteSlot | null {
  return order === 0 ? null : order < 0 ? pair[0].id : pair[1].id;
}

function scanAbove(
  pair: readonly [QuoteRecord, QuoteRecord],
  start: number,
  limit: number,
  now: Order,
  needs: PlanRequirements,
): FlipAbove | null {
  for (let guests = start + 1; guests <= limit; guests += 1) {
    const order = orderAt(pair, guests, needs);
    if (order !== null && order === -now) {
      const cheaper = cheaperOf(pair, order);
      return cheaper === null ? null : { cheaper, fromGuests: guests };
    }
  }
  return null;
}

function scanBelow(
  pair: readonly [QuoteRecord, QuoteRecord],
  start: number,
  now: Order,
  needs: PlanRequirements,
): FlipBelow | null {
  for (let guests = start - 1; guests >= 1; guests -= 1) {
    const order = orderAt(pair, guests, needs);
    if (order !== null && order === -now) {
      const cheaper = cheaperOf(pair, order);
      return cheaper === null ? null : { cheaper, belowGuests: guests + 1 };
    }
  }
  return null;
}

export function breakEven(
  pair: readonly [QuoteRecord, QuoteRecord],
  guests: number,
  needs: PlanRequirements,
): QuoteResult<BreakEven> {
  if (!Number.isSafeInteger(guests) || guests < 1) return refused('guests-out-of-range');
  const quotes: readonly [QuoteSlot, QuoteSlot] = [pair[0].id, pair[1].id];
  const unavailable = pair.filter((quote) => totalAt(quote, guests, needs) === null);
  const now = orderAt(pair, guests, needs);
  if (now === null) {
    return accepted({ kind: 'not-comparable', quotes, unavailable: unavailable.map((q) => q.id) });
  }
  const cap = lowestCap(pair);
  const limit = Math.min(guests * 2, SCAN_CEILING_GUESTS, cap?.cap ?? SCAN_CEILING_GUESTS);
  // A tie is not a ranking, so there is nothing to flip.
  const scanned = now !== 0;
  return accepted({
    kind: 'compared',
    quotes,
    guests,
    cheaperNow: cheaperOf(pair, now),
    above: scanned ? scanAbove(pair, guests, limit, now, needs) : null,
    below: scanned ? scanBelow(pair, guests, now, needs) : null,
    // Reported only when the cap, not the doubling or the ceiling, is what ends the scan.
    capEnd: cap !== null && cap.cap < Math.min(guests * 2, SCAN_CEILING_GUESTS) ? cap : null,
    beforeGstOf: pair.filter(taxIsUnsettled).map((quote) => quote.id),
    scannedTo: Math.max(limit, guests),
  });
}

/** Every pair of quotes within one category, in slot order; at most 15 pairs for six quotes. */
export function breakEvenAll(
  quotes: readonly QuoteRecord[],
  guests: number,
  needs: PlanRequirements,
): QuoteResult<readonly BreakEven[]> {
  const sorted = [...quotes].sort((a, b) => a.id.localeCompare(b.id));
  const results: BreakEven[] = [];
  for (const [index, first] of sorted.entries()) {
    for (const second of sorted.slice(index + 1)) {
      if (first.category !== second.category) continue;
      const result = breakEven([first, second], guests, needs);
      if (!result.ok) return result;
      results.push(result.value);
    }
  }
  return accepted(results);
}
