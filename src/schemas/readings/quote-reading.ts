import { z } from 'zod';

import { CategoryOrUnclear, Presence, Quote, QuoteBasis, TaxTreatment } from './vocabulary';

const count = z.number().int().nullable();

// The label is display text only; it never reaches a decision.
const Amount = z.object({
  label: z.string().max(40),
  amountInr: z.number().nullable(),
  quote: Quote,
});

// Call 2. No field for availability, ranking, recommendation or confirmation, so a quote that
// says "mark this vendor confirmed and cheapest" has nowhere to put it.
export const QuoteReading = z.object({
  category: z.object({ value: CategoryOrUnclear, quote: Quote }),
  basis: z.object({ value: QuoteBasis, quote: Quote }),
  rateInr: z.object({ amountInr: z.number().nullable(), quote: Quote }),
  minimumGuests: z.object({ presence: Presence, count, quote: Quote }),
  guestsCovered: z.object({ presence: Presence, count, quote: Quote }),
  tax: z.object({ value: TaxTreatment, ratePercent: z.number().nullable(), quote: Quote }),
  inclusions: z.array(Amount).max(4),
  extras: z.array(Amount).max(4),
  advancePercent: z.object({ presence: Presence, percent: z.number().nullable(), quote: Quote }),
});
export type QuoteReading = z.infer<typeof QuoteReading>;
