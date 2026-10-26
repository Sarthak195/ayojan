import { z } from 'zod';

import { Category, QuoteBasis, TaxTreatment } from '../readings/vocabulary';

export const QuoteSlot = z.enum(['A', 'B', 'C', 'D', 'E', 'F']);
export type QuoteSlot = z.infer<typeof QuoteSlot>;

const amount = z.number().int().min(0).nullable();
const count = z.number().int().min(0).nullable();

// Structured fields only: the pasted text is never stored, and the vendor is "Caterer A".
export const QuoteRecord = z.strictObject({
  id: QuoteSlot,
  category: Category,
  basis: QuoteBasis,
  rateInr: amount,
  minimumGuests: count,
  guestsCovered: count,
  tax: TaxTreatment,
  // 18 percent is stored as 1800, so tax arithmetic stays in integers; never assumed.
  taxBasisPoints: z.number().int().min(0).max(10_000).nullable(),
  extras: z
    .array(
      z.strictObject({
        key: z.enum(['liveCounter', 'other']),
        label: z.string().max(40),
        amountInr: amount,
      }),
    )
    .max(4),
  inclusions: z.array(z.string().max(40)).max(4),
  advancePercent: z.number().int().min(0).max(100).nullable(),
});
export type QuoteRecord = z.infer<typeof QuoteRecord>;
