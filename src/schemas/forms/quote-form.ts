import { z } from 'zod';

import { Category, QuoteBasis, TaxTreatment } from '../readings/vocabulary';
import { OptionalInteger, TokenField, listOf } from './form-field';

// The quote form twin, inside "Enter the quote by form" on the quotes page.
export const QuoteForm = z.strictObject({
  token: TokenField,
  category: Category,
  basis: QuoteBasis,
  rateInr: OptionalInteger,
  minimumGuests: OptionalInteger,
  guestsCovered: OptionalInteger,
  tax: TaxTreatment,
  // Whole percent or with up to two decimals ("18", "12.5"); stored later as basis points.
  taxRatePercent: z.union([z.literal(''), z.string().regex(/^\d{1,2}(?:\.\d{1,2})?$/)]),
  liveCounterInr: OptionalInteger,
  inclusion: listOf(z.string().max(40), 4),
  advancePercent: OptionalInteger,
});
export type QuoteForm = z.infer<typeof QuoteForm>;
