// Tax is shown, never assumed (spec C5): a rate the vendor did not state is not filled in with
// 18 percent, and a quote that never mentions GST is treated like one that is unclear about it,
// because silence is not "included".

import type { QuoteRecord } from '@/schemas/plan/quote-record';

import type { Money } from '../money/money';
import { money, scale } from '../money/money';
import type { QuoteResult, TaxOutcome } from './quote-types';
import { accepted, refused } from './quote-types';

const BASIS_POINTS = 10_000;

/** True when the total would change once the vendor says what tax applies. */
export function taxIsUnsettled(quote: QuoteRecord): boolean {
  switch (quote.tax) {
    case 'included':
      return false;
    case 'extraWithRate':
      return quote.taxBasisPoints === null;
    case 'extraRateUnstated':
    case 'unclear':
    case 'absent':
      return true;
  }
}

export function settleTax(quote: QuoteRecord, beforeTax: Money): QuoteResult<TaxOutcome> {
  if (quote.tax === 'included')
    return accepted({ kind: 'included', basisPoints: null, amount: null });
  if (quote.tax === 'extraRateUnstated') {
    return accepted({ kind: 'rate-not-stated', basisPoints: null, amount: null });
  }
  if (quote.tax === 'extraWithRate' && quote.taxBasisPoints !== null) {
    const tax = scale(beforeTax, quote.taxBasisPoints, BASIS_POINTS);
    if (!tax.ok) return refused(tax.reason);
    const amount = money(tax.value.inr, 'from-quote');
    return amount.ok
      ? accepted({ kind: 'added', basisPoints: quote.taxBasisPoints, amount: amount.value })
      : refused(amount.reason);
  }
  return accepted({ kind: 'unclear', basisPoints: null, amount: null });
}
