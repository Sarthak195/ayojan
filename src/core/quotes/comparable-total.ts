// The comparable total of one quote at the plan's current guest count (architecture 4.7, FR-17):
//   per plate: max(guests, minimum) x rate
//   lump sum:  the sum while guests <= guests covered, else cap exceeded (never scaled)
//   per day:   unclear, because the quote has no number of days (decision D5)
// then the extras the plan requires, then tax if its rate is known. A missing number is a
// question for the vendor, never a zero.

import type { QuoteRecord } from '@/schemas/plan/quote-record';

import type { Money } from '../money/money';
import { scale, sum } from '../money/money';
import { countedExtras, liveCounterMissing } from './extras';
import type {
  ComparableAmount,
  ComparableTotal,
  PlanRequirements,
  QuoteGap,
  QuoteResult,
} from './quote-types';
import { accepted, refused } from './quote-types';
import { settleTax, taxIsUnsettled } from './tax';

interface Priced {
  readonly base: Money;
  readonly billedPlates: number | null;
  readonly gaps: readonly QuoteGap[];
}

type Pricing =
  | { readonly kind: 'priced'; readonly priced: Priced }
  | { readonly kind: 'cap-exceeded'; readonly cap: number; readonly gaps: readonly QuoteGap[] }
  | { readonly kind: 'unclear'; readonly gaps: readonly QuoteGap[] };

function fromQuote(inr: number): Money {
  return { inr, provenance: 'from-quote' };
}

// A rate of zero is treated like a missing one: a free caterer is far more likely to be a
// number the vendor never gave than a gift, and 0 would win every ranking.
function hasRate(rate: number | null): rate is number {
  return rate !== null && rate > 0;
}

function perPlate(quote: QuoteRecord, guests: number): QuoteResult<Pricing> {
  if (!hasRate(quote.rateInr)) return accepted({ kind: 'unclear', gaps: ['rate'] });
  const minimum = quote.minimumGuests ?? 0;
  const plates = Math.max(guests, minimum);
  const base = scale(fromQuote(quote.rateInr), plates, 1);
  if (!base.ok) return refused(base.reason);
  // The rate above the minimum is never stated in a quote, so it is asked whenever a minimum
  // exists; without a stated minimum the minimum itself is what is asked.
  const gaps: QuoteGap[] =
    quote.minimumGuests === null
      ? ['minimumGuests']
      : quote.minimumGuests > 0
        ? ['rateAboveMinimum']
        : [];
  return accepted({
    kind: 'priced',
    priced: { base: fromQuote(base.value.inr), billedPlates: plates, gaps },
  });
}

function lumpSum(quote: QuoteRecord, guests: number): QuoteResult<Pricing> {
  if (!hasRate(quote.rateInr)) return accepted({ kind: 'unclear', gaps: ['rate'] });
  const cap = quote.guestsCovered;
  // No stated cover is a question, not a cap of zero: the total is as quoted.
  if (cap === null || cap < 1) {
    const priced: Priced = {
      base: fromQuote(quote.rateInr),
      billedPlates: null,
      gaps: ['guestsCovered'],
    };
    return accepted({ kind: 'priced', priced });
  }
  if (guests > cap) return accepted({ kind: 'cap-exceeded', cap, gaps: [] });
  const priced: Priced = { base: fromQuote(quote.rateInr), billedPlates: null, gaps: [] };
  return accepted({ kind: 'priced', priced });
}

function price(quote: QuoteRecord, guests: number): QuoteResult<Pricing> {
  switch (quote.basis) {
    case 'perPlate':
      return perPlate(quote, guests);
    case 'lumpSum':
      return lumpSum(quote, guests);
    case 'perDay':
      return accepted({ kind: 'unclear', gaps: ['days'] });
    case 'unclear':
      return accepted({ kind: 'unclear', gaps: ['basis'] });
  }
}

function extraGaps(quote: QuoteRecord, requirements: PlanRequirements): readonly QuoteGap[] {
  return liveCounterMissing(quote, requirements) ? ['liveCounter'] : [];
}

function priceableAmounts(quote: QuoteRecord): boolean {
  const amounts = [
    quote.rateInr,
    quote.minimumGuests,
    quote.guestsCovered,
    ...quote.extras.map((extra) => extra.amountInr),
  ];
  return amounts.every((amount) => amount === null || Number.isSafeInteger(amount));
}

export function comparableTotal(
  quote: QuoteRecord,
  guests: number,
  requirements: PlanRequirements,
): QuoteResult<ComparableTotal> {
  if (!Number.isSafeInteger(guests) || guests < 1) return refused('guests-out-of-range');
  if (!priceableAmounts(quote)) return refused('out-of-range');
  const pricing = price(quote, guests);
  if (!pricing.ok) return pricing;
  const taxGap: readonly QuoteGap[] = taxIsUnsettled(quote) ? ['taxRate'] : [];
  const extra = extraGaps(quote, requirements);
  const found = pricing.value;
  const common = { quoteId: quote.id, guests };
  if (found.kind === 'unclear') {
    return accepted({ ...common, status: 'unclear', gaps: [...found.gaps, ...taxGap, ...extra] });
  }
  if (found.kind === 'cap-exceeded') {
    return accepted({
      ...common,
      status: 'cap-exceeded',
      cap: found.cap,
      gaps: [...found.gaps, ...taxGap, ...extra],
    });
  }
  return pricedTotal(quote, requirements, { ...common, priced: found.priced, taxGap, extra });
}

interface PricedContext {
  readonly quoteId: ComparableAmount['quoteId'];
  readonly guests: number;
  readonly priced: Priced;
  readonly taxGap: readonly QuoteGap[];
  readonly extra: readonly QuoteGap[];
}

function pricedTotal(
  quote: QuoteRecord,
  requirements: PlanRequirements,
  context: PricedContext,
): QuoteResult<ComparableTotal> {
  const extras = countedExtras(quote, requirements);
  const charged = extras.flatMap((line) => (line.counted && line.amount ? [line.amount] : []));
  const beforeTax = sum([context.priced.base, ...charged]);
  if (!beforeTax.ok) return refused(beforeTax.reason);
  const tax = settleTax(quote, beforeTax.value);
  if (!tax.ok) return tax;
  const total = sum([beforeTax.value, ...(tax.value.amount ? [tax.value.amount] : [])]);
  if (!total.ok) return refused(total.reason);
  return accepted({
    quoteId: context.quoteId,
    guests: context.guests,
    status: 'comparable',
    billedPlates: context.priced.billedPlates,
    base: context.priced.base,
    extras,
    beforeTax: fromQuote(beforeTax.value.inr),
    tax: tax.value,
    total: fromQuote(total.value.inr),
    plusGstRateNotStated: tax.value.kind === 'rate-not-stated' || tax.value.kind === 'unclear',
    gaps: [...context.priced.gaps, ...context.taxGap, ...context.extra],
  });
}
