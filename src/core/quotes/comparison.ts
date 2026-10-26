// The side-by-side table for one category's quotes (architecture 4.7, FR-18). The rows are the
// explainer's own four headings, then the comparable total and the gap against the family's
// split. Cells carry structured facts, not sentences, so the view words them in either
// language; no cell says a vendor is available or a price confirmed, because nothing here
// knows that.

import type { QuoteRecord, QuoteSlot } from '@/schemas/plan/quote-record';
import type { Category } from '@/schemas/readings/vocabulary';

import type { Money } from '../money/money';
import type { BreakEven } from './break-even';
import { breakEvenAll } from './break-even';
import { countedExtras } from './extras';
import type {
  ComparableTotal,
  CountedExtra,
  PlanRequirements,
  QuoteGap,
  QuoteResult,
  TaxKind,
} from './quote-types';
import { accepted } from './quote-types';
import type { RowKey } from './quote-wording';
import { rankComparable, totalsFor } from './ranking';
import { settleTax } from './tax';

export type GuestsCoveredCell =
  | { readonly kind: 'per-plate'; readonly minimumPlates: number | null }
  | { readonly kind: 'up-to'; readonly guests: number }
  | { readonly kind: 'not-stated' }
  | { readonly kind: 'unknown' };

export interface ChargesCell {
  readonly tax: TaxKind;
  readonly taxBasisPoints: number | null;
  readonly extras: readonly CountedExtra[];
  readonly advancePercent: number | null;
}

export interface ClarificationCell {
  readonly gaps: readonly QuoteGap[];
  /** Set when a lump sum no longer covers the guests: "guest cap exceeded: re-quote needed". */
  readonly capExceededAt: number | null;
}

export type ComparisonRow =
  | { readonly key: 'included'; readonly cells: readonly (readonly string[])[] }
  | { readonly key: 'guestsCovered'; readonly cells: readonly GuestsCoveredCell[] }
  | { readonly key: 'additionalCharges'; readonly cells: readonly ChargesCell[] }
  | { readonly key: 'needsClarification'; readonly cells: readonly ClarificationCell[] }
  | { readonly key: 'comparableTotal'; readonly cells: readonly ComparableTotal[] }
  /** Total minus the category's allocation: positive is above the split; null if no total. */
  | { readonly key: 'againstSplit'; readonly cells: readonly (Money | null)[] };

/** The order the rows appear in; the headings come from rowHeading in quote-wording. */
export const ROW_ORDER: readonly RowKey[] = [
  'included',
  'guestsCovered',
  'additionalCharges',
  'needsClarification',
  'comparableTotal',
  'againstSplit',
];

export interface ComparisonColumn {
  readonly quoteId: QuoteSlot;
  /** Always true: every quote is unconfirmed until the family books it on the timeline. */
  readonly unconfirmed: true;
}

export interface Comparison {
  readonly category: Category;
  readonly guests: number;
  readonly columns: readonly ComparisonColumn[];
  readonly rows: readonly ComparisonRow[];
  /** Comparable quotes, cheapest first; fewer than two means there is no ranking to show. */
  readonly ranking: readonly QuoteSlot[];
  readonly breakEvens: readonly BreakEven[];
}

export interface ComparisonInput {
  readonly category: Category;
  readonly quotes: readonly QuoteRecord[];
  readonly guests: number;
  readonly requirements: PlanRequirements;
  /** The category's frozen allocation plus any Move-money delta, as the projection holds it. */
  readonly allocation: Money;
}

function guestsCoveredCell(quote: QuoteRecord): GuestsCoveredCell {
  if (quote.basis === 'perPlate') return { kind: 'per-plate', minimumPlates: quote.minimumGuests };
  if (quote.basis !== 'lumpSum') return { kind: 'unknown' };
  const cover = quote.guestsCovered;
  return cover !== null && cover >= 1 ? { kind: 'up-to', guests: cover } : { kind: 'not-stated' };
}

function chargesCell(quote: QuoteRecord, requirements: PlanRequirements): ChargesCell {
  // The kind is read from a zero amount so the table and the total share one tax rule.
  const settled = settleTax(quote, { inr: 0, provenance: 'from-quote' });
  return {
    tax: settled.ok ? settled.value.kind : 'unclear',
    taxBasisPoints: quote.tax === 'extraWithRate' ? quote.taxBasisPoints : null,
    extras: countedExtras(quote, requirements),
    advancePercent: quote.advancePercent,
  };
}

function againstSplit(total: ComparableTotal, allocation: Money): Money | null {
  if (total.status !== 'comparable') return null;
  return { inr: total.total.inr - allocation.inr, provenance: 'computed' };
}

export function compareQuotes(input: ComparisonInput): QuoteResult<Comparison> {
  const quotes = input.quotes
    .filter((quote) => quote.category === input.category)
    .sort((a, b) => a.id.localeCompare(b.id));
  const totals = totalsFor(quotes, input.guests, input.requirements);
  if (!totals.ok) return totals;
  const breakEvens = breakEvenAll(quotes, input.guests, input.requirements);
  if (!breakEvens.ok) return breakEvens;
  return accepted({
    category: input.category,
    guests: input.guests,
    columns: quotes.map((quote) => ({ quoteId: quote.id, unconfirmed: true })),
    rows: [
      { key: 'included', cells: quotes.map((quote) => quote.inclusions) },
      { key: 'guestsCovered', cells: quotes.map(guestsCoveredCell) },
      {
        key: 'additionalCharges',
        cells: quotes.map((quote) => chargesCell(quote, input.requirements)),
      },
      {
        key: 'needsClarification',
        cells: totals.value.map((total) => ({
          gaps: total.gaps,
          capExceededAt: total.status === 'cap-exceeded' ? total.cap : null,
        })),
      },
      { key: 'comparableTotal', cells: totals.value },
      {
        key: 'againstSplit',
        cells: totals.value.map((total) => againstSplit(total, input.allocation)),
      },
    ],
    ranking: rankComparable(totals.value).map((total) => total.quoteId),
    breakEvens: breakEvens.value,
  });
}
