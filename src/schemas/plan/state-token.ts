import { z } from 'zod';

import {
  Category,
  Diet,
  FunctionName,
  GuestNeed,
  MustHave,
  Occasion,
  Priority,
  VenueLimit,
} from '../readings/vocabulary';
import { FunctionAnswer, IsoDate, ReadBy } from './brief';
import { MAX_OPS, Op } from './op';
import { QuoteRecord } from './quote-record';
import { ShortText } from './short-text';

export const MAX_DISPLAY_QUOTES = 16;

export const VerdictStatus = z.enum(['verified', 'unverified', 'unclear', 'absent']);
export const VerdictReason = z.enum([
  'quote-not-found',
  'number-not-in-quote',
  'out-of-bounds',
  'quote-too-short',
  'quote-too-long',
]);

// One checked value of a reading. The quote is already verified before sealing, so cutting it
// to 80 bytes changes only what the check screen shows (D31).
export const FieldVerdict = z.strictObject({
  field: z.string().max(40),
  status: VerdictStatus,
  reason: VerdictReason.nullable(),
  displayQuote: ShortText.nullable(),
});
export type FieldVerdict = z.infer<typeof FieldVerdict>;

const count = z.number().int().nullable();

// Values are unbounded integers here on purpose: an out-of-range value the user really said
// (0 guests, a past date) must survive to the check screen as a question, not fail parsing.
const BriefValues = z.strictObject({
  occasion: Occasion.nullable(),
  budgetInr: count,
  guests: count,
  eventDate: IsoDate.nullable(),
  venueCapacity: count,
  functions: z.record(FunctionName, FunctionAnswer),
  priorities: z.record(Category, Priority),
  mustHaves: z.array(MustHave).max(4),
  needs: z.array(GuestNeed).max(3),
  diet: z.array(Diet).max(3),
  venueLimits: z.array(VenueLimit).max(2),
  notes: z.array(ShortText).max(6),
});

const QuoteValues = QuoteRecord.omit({ id: true }).extend({ category: Category.nullable() });

const ChangeValues = z.strictObject({
  guests: z
    .strictObject({ mode: z.enum(['absolute', 'delta']), count: z.number().int() })
    .nullable(),
  budget: z
    .strictObject({
      mode: z.enum(['absolute', 'delta', 'directionOnly']),
      direction: z.enum(['increase', 'decrease', 'none']),
      amountInr: count,
    })
    .nullable(),
  // Two candidates when a day shift and a written date disagree; the user picks ("Which date?").
  dateCandidates: z.array(IsoDate).max(2),
  reallocate: z.strictObject({ to: Category.nullable(), amountInr: count }).nullable(),
  sources: z.array(ShortText).max(3),
});

const fields = z.array(FieldVerdict).max(MAX_DISPLAY_QUOTES);

export const PendingReading = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('brief'), values: BriefValues, fields, readBy: ReadBy }),
  z.strictObject({ kind: z.literal('quote'), values: QuoteValues, fields, readBy: ReadBy }),
  z.strictObject({ kind: z.literal('change'), values: ChangeValues, fields, readBy: ReadBy }),
]);
export type PendingReading = z.infer<typeof PendingReading>;

// What the sealed link holds: inputs and ops, never computed numbers.
export const StateToken = z.strictObject({
  schema: z.literal(1),
  ops: z.array(Op).max(MAX_OPS),
  pending: PendingReading.optional(),
});
export type StateToken = z.infer<typeof StateToken>;
