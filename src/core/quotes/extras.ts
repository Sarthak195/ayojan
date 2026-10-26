// Which of a quote's extras the plan actually pays for. A live counter priced in the quote is
// added only when the family named it a must-have; anything else stays visible but uncounted,
// so a total never carries a charge nobody asked for.

import type { QuoteRecord } from '@/schemas/plan/quote-record';

import type { CountedExtra, PlanRequirements } from './quote-types';

export function countedExtras(
  quote: QuoteRecord,
  requirements: PlanRequirements,
): readonly CountedExtra[] {
  return quote.extras.map((extra) => ({
    key: extra.key,
    label: extra.label,
    amount: extra.amountInr === null ? null : { inr: extra.amountInr, provenance: 'from-quote' },
    counted:
      extra.key === 'liveCounter' &&
      quote.category === 'catering' &&
      requirements.liveCounterRequired &&
      extra.amountInr !== null,
  }));
}

/** True when the plan needs a live counter and this caterer's quote does not price one. */
export function liveCounterMissing(quote: QuoteRecord, requirements: PlanRequirements): boolean {
  if (!requirements.liveCounterRequired || quote.category !== 'catering') return false;
  return !quote.extras.some((extra) => extra.key === 'liveCounter' && extra.amountInr !== null);
}
