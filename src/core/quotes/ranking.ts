// Ranking and the figure the budget takes from quotes. Quotes are only ever compared with
// others of the same category, ordered by comparable total before any tax whose rate is
// unknown; ties keep slot order so the answer never depends on object iteration.

import type { QuoteRecord, QuoteSlot } from '@/schemas/plan/quote-record';
import type { Category } from '@/schemas/readings/vocabulary';

import { comparableTotal } from './comparable-total';
import type {
  ComparableAmount,
  ComparableTotal,
  PlanRequirements,
  QuoteResult,
} from './quote-types';
import { accepted } from './quote-types';

export function totalsFor(
  quotes: readonly QuoteRecord[],
  guests: number,
  requirements: PlanRequirements,
): QuoteResult<readonly ComparableTotal[]> {
  const totals: ComparableTotal[] = [];
  for (const quote of quotes) {
    const total = comparableTotal(quote, guests, requirements);
    if (!total.ok) return total;
    totals.push(total.value);
  }
  return accepted(totals);
}

/** The comparable quotes, cheapest first; cap-exceeded and unclear quotes are left out. */
export function rankComparable(totals: readonly ComparableTotal[]): readonly ComparableAmount[] {
  return totals
    .filter((total): total is ComparableAmount => total.status === 'comparable')
    .sort((a, b) => a.total.inr - b.total.inr || a.quoteId.localeCompare(b.quoteId));
}

export interface CheapestQuote {
  readonly quoteId: QuoteSlot;
  /** The shape the projection takes as `evidence[category].quote`. */
  readonly totalInr: number;
  readonly plusGstRateNotStated: boolean;
}

/**
 * The cheapest comparable total per category at the current guests, which the projection
 * reads as the category's quote evidence. A category whose quotes are all unclear or over
 * their cap has no entry, so the projection falls back to the allocation.
 */
export function cheapestByCategory(
  quotes: readonly QuoteRecord[],
  guests: number,
  requirements: PlanRequirements,
): QuoteResult<Readonly<Partial<Record<Category, CheapestQuote>>>> {
  const totals = totalsFor(quotes, guests, requirements);
  if (!totals.ok) return totals;
  const found: Partial<Record<Category, CheapestQuote>> = {};
  const categoryOf = new Map(quotes.map((quote) => [quote.id, quote.category]));
  for (const total of rankComparable(totals.value)) {
    const category = categoryOf.get(total.quoteId);
    if (category === undefined || found[category] !== undefined) continue;
    found[category] = {
      quoteId: total.quoteId,
      totalInr: total.total.inr,
      plusGstRateNotStated: total.plusGstRateNotStated,
    };
  }
  return accepted(found);
}
