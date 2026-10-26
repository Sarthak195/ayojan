import type { QuoteRecord, QuoteSlot } from '@/schemas/plan/quote-record';
import { QuoteSlot as QuoteSlots } from '@/schemas/plan/quote-record';
import type { FieldVerdict, PendingReading } from '@/schemas/plan/state-token';
import type { Category, QuoteBasis, TaxTreatment } from '@/schemas/readings/vocabulary';

// The one translation from posted quote fields to stored quote values, shared by the form
// twin and the check page, so a quote typed by hand and one read from a message become the
// same record from the same facts (FR-16).

export type QuoteValues = Extract<PendingReading, { kind: 'quote' }>['values'];
type Extra = QuoteValues['extras'][number];

/** The quote fields as the two forms post them, after the form schema has parsed them. */
export interface QuoteFields {
  readonly category: Category | null;
  readonly basis: QuoteBasis;
  readonly rateInr: number | null;
  readonly minimumGuests: number | null;
  readonly guestsCovered: number | null;
  readonly tax: TaxTreatment;
  /** "18" or "12.5"; empty when the vendor named no rate. */
  readonly taxRatePercent: string;
  readonly liveCounterInr: number | null;
  readonly inclusion: readonly string[];
  readonly advancePercent: number | null;
}

const MAX_EXTRAS = 4;
const MAX_ADVANCE_PERCENT = 100;
export const LIVE_COUNTER_LABEL = 'Live counter';

/** The first free vendor letter, or null when the plan already holds six quotes. */
export function nextSlot(quotes: readonly Pick<QuoteRecord, 'id'>[]): QuoteSlot | null {
  return QuoteSlots.options.find((slot) => !quotes.some((quote) => quote.id === slot)) ?? null;
}

// A GST rate is never assumed: "extra with rate" and no rate is the rate-unstated case, so
// the total is shown without tax and the vendor is asked (spec C5).
function taxOf(fields: QuoteFields): Pick<QuoteValues, 'tax' | 'taxBasisPoints'> {
  if (fields.tax !== 'extraWithRate') return { tax: fields.tax, taxBasisPoints: null };
  if (fields.taxRatePercent === '') return { tax: 'extraRateUnstated', taxBasisPoints: null };
  return { tax: 'extraWithRate', taxBasisPoints: Math.round(Number(fields.taxRatePercent) * 100) };
}

/**
 * The quote's values from the posted fields. `otherExtras` are the read extras that the form
 * does not show as inputs (anything but the live counter); they ride along unchanged.
 */
export function valuesFrom(fields: QuoteFields, otherExtras: readonly Extra[] = []): QuoteValues {
  const liveCounter: Extra[] =
    fields.liveCounterInr === null
      ? []
      : [{ key: 'liveCounter', label: LIVE_COUNTER_LABEL, amountInr: fields.liveCounterInr }];
  const others = otherExtras.filter((extra) => extra.key === 'other');
  return {
    category: fields.category,
    basis: fields.basis,
    rateInr: fields.rateInr,
    minimumGuests: fields.minimumGuests,
    guestsCovered: fields.guestsCovered,
    ...taxOf(fields),
    extras: [...liveCounter, ...others].slice(0, MAX_EXTRAS),
    inclusions: fields.inclusion
      .map((item) => item.trim())
      .filter((item) => item !== '')
      .slice(0, 4),
    advancePercent: fields.advancePercent,
  };
}

/** The values a quote check would ask about again before the quote can be stored. */
export interface QuoteIssues {
  readonly values: QuoteValues;
  /** Verdicts naming why a value was set aside, shown on the check page as its question. */
  readonly verdicts: readonly FieldVerdict[];
}

/**
 * A record when the values can be stored, else the issues for the check page. The category is
 * the only value a stored quote cannot do without; an unclear basis or a missing rate is kept
 * and becomes a question for the vendor. An advance above 100 percent cannot be stored at all.
 */
export function recordOrIssues(
  values: QuoteValues,
  slot: QuoteSlot,
): { readonly ok: true; readonly record: QuoteRecord } | ({ readonly ok: false } & QuoteIssues) {
  const verdicts: FieldVerdict[] = [];
  let advancePercent = values.advancePercent;
  if (advancePercent !== null && advancePercent > MAX_ADVANCE_PERCENT) {
    advancePercent = null;
    verdicts.push({
      field: 'advancePercent',
      status: 'unclear',
      reason: 'out-of-bounds',
      displayQuote: null,
    });
  }
  const kept = { ...values, advancePercent };
  if (kept.category === null || verdicts.length > 0) {
    return { ok: false, values: kept, verdicts };
  }
  return { ok: true, record: { ...kept, id: slot, category: kept.category } };
}

/** The read values as form fields, so the check page starts from what was read. */
export function fieldsFrom(values: QuoteValues): QuoteFields {
  const liveCounter = values.extras.find((extra) => extra.key === 'liveCounter');
  return {
    category: values.category,
    basis: values.basis,
    rateInr: values.rateInr,
    minimumGuests: values.minimumGuests,
    guestsCovered: values.guestsCovered,
    tax: values.tax,
    taxRatePercent: values.taxBasisPoints === null ? '' : String(values.taxBasisPoints / 100),
    liveCounterInr: liveCounter?.amountInr ?? null,
    inclusion: values.inclusions,
    advancePercent: values.advancePercent,
  };
}
