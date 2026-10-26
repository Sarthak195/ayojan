import { z } from 'zod';

import { listOf, OptionalInteger } from '@/schemas/forms/form-field';
import { QuoteForm } from '@/schemas/forms/quote-form';
import { Category, QuoteBasis, TaxTreatment } from '@/schemas/readings/vocabulary';

import type { QuoteFields } from './quote-record';

// The quote check page's inputs on top of the shared confirm fields. Names match the quote
// form twin (QuoteForm), so one builder reads both posts. Every field is optional because the
// same route confirms brief and change readings, whose pages carry none of them; the category
// radio can also arrive unanswered, which sends the reading back to its check page.
export const QUOTE_CONFIRM_FIELDS = {
  category: Category.optional(),
  basis: QuoteBasis.optional(),
  rateInr: OptionalInteger.optional(),
  minimumGuests: OptionalInteger.optional(),
  guestsCovered: OptionalInteger.optional(),
  tax: TaxTreatment.optional(),
  taxRatePercent: QuoteForm.shape.taxRatePercent.optional(),
  liveCounterInr: OptionalInteger.optional(),
  inclusion: listOf(z.string().max(40), 4),
  advancePercent: OptionalInteger.optional(),
};

export type QuoteConfirmPart = z.output<z.ZodObject<typeof QUOTE_CONFIRM_FIELDS>>;

/**
 * The posted answers as quote fields. A field missing from the post keeps the read value,
 * as on the brief check page; an empty number field means the person cleared it.
 */
export function quoteFieldsOf(form: QuoteConfirmPart, read: QuoteFields): QuoteFields {
  return {
    category: form.category ?? read.category,
    basis: form.basis ?? read.basis,
    rateInr: form.rateInr === undefined ? read.rateInr : form.rateInr,
    minimumGuests: form.minimumGuests === undefined ? read.minimumGuests : form.minimumGuests,
    guestsCovered: form.guestsCovered === undefined ? read.guestsCovered : form.guestsCovered,
    tax: form.tax ?? read.tax,
    taxRatePercent: form.taxRatePercent ?? read.taxRatePercent,
    liveCounterInr: form.liveCounterInr === undefined ? read.liveCounterInr : form.liveCounterInr,
    inclusion: form.inclusion,
    advancePercent: form.advancePercent === undefined ? read.advancePercent : form.advancePercent,
  };
}
