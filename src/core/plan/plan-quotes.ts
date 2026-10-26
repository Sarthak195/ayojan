// The quote comparison for every category the family has quotes for (architecture 4.7, FR-18),
// measured at the current guests against the category's allocation as the projection holds it.

import type { QuoteRecord } from '@/schemas/plan/quote-record';
import type { Category } from '@/schemas/readings/vocabulary';

import type { Projection } from '../budget/projection';
import { compareQuotes, type Comparison } from '../quotes/comparison';
import type { PlanRequirements } from '../quotes/quote-types';
import { planOk, quotesFail, type PlanResult } from './plan-refusal';

export function planComparisons(
  quotes: readonly QuoteRecord[],
  projection: Projection,
  requirements: PlanRequirements,
): PlanResult<readonly Comparison[]> {
  const quoted = new Set<Category>(quotes.map((quote) => quote.category));
  const comparisons: Comparison[] = [];
  for (const category of projection.order) {
    if (!quoted.has(category)) continue;
    const comparison = compareQuotes({
      category,
      quotes,
      guests: projection.guestsNow,
      requirements,
      allocation: projection.lines[category].allocation,
    });
    if (!comparison.ok) return quotesFail(comparison.reason);
    comparisons.push(comparison.value);
  }
  return planOk(comparisons);
}
