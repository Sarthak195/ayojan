import { z } from 'zod';

import { NumberText, OptionalDate, TokenField, optionalChoice } from './form-field';

// Confirm or Cancel on the check page. Answers are optional because only the questions the
// pending reading raised are on the page; none has a default, so an unanswered question
// arrives empty and the route refuses to apply the change.
export const CheckConfirm = z.strictObject({
  token: TokenField,
  intent: z.enum(['confirm', 'cancel']),
  budget: NumberText.optional(),
  guests: NumberText.optional(),
  eventDate: OptionalDate.optional(),
  venueCapacity: NumberText.optional(),
  // "By how much?" for a budget read as a direction only (FR-24).
  budgetChoice: optionalChoice(z.enum(['percent5', 'percent10', 'exact'])).optional(),
  budgetExact: NumberText.optional(),
  // "Which date?" when a day shift and a written date disagree.
  dateChoice: optionalChoice(z.enum(['shift', 'written'])).optional(),
});
export type CheckConfirm = z.infer<typeof CheckConfirm>;
