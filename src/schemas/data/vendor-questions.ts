import { z } from 'zod';

import { Category, Diet, GuestNeed, MustHave, VenueLimit } from '../readings/vocabulary';
import { RowId, planningRow } from './planning-row';

// What makes the engine ask this question. Closed, so the mapping from a reading or a plan
// state to a question is a lookup, never a judgement.
const RaisedBy = z.discriminatedUnion('when', [
  z.strictObject({
    when: z.literal('unclearField'),
    field: z.enum(['taxRate', 'minimumGuests', 'guestsCovered', 'rateAboveMinimum', 'days']),
  }),
  z.strictObject({ when: z.literal('capExceeded') }),
  z.strictObject({
    when: z.literal('reconfirmation'),
    subject: z.enum(['date', 'guests', 'capacity']),
  }),
  z.strictObject({ when: z.literal('mustHave'), mustHave: MustHave }),
  z.strictObject({ when: z.literal('need'), need: GuestNeed }),
  z.strictObject({ when: z.literal('diet'), diet: Diet }),
  z.strictObject({ when: z.literal('venueLimit'), venueLimit: VenueLimit }),
]);

export const QUESTION_PLACEHOLDERS: readonly string[] = ['guests', 'capacity', 'date'];

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{([^}]*)\}/g)].map((match) => match[1] ?? '').sort();
}

const QuestionRow = z
  .strictObject({
    id: RowId,
    // The vendors this question is for; empty means any vendor with a quote or booking.
    categories: z.array(Category),
    raisedBy: RaisedBy,
    ...planningRow,
  })
  .refine((row) => placeholders(row.en).every((name) => QUESTION_PLACEHOLDERS.includes(name)), {
    message: 'Unknown placeholder in the English text.',
    path: ['en'],
  })
  .refine((row) => placeholders(row.en).join(',') === placeholders(row.hi).join(','), {
    message: 'The Hindi text must use the same placeholders as the English.',
    path: ['hi'],
  });

export const VendorQuestionsFile = z.strictObject({ questions: z.array(QuestionRow).min(1) });
export type VendorQuestionsFile = z.infer<typeof VendorQuestionsFile>;
export type QuestionRow = z.infer<typeof QuestionRow>;
