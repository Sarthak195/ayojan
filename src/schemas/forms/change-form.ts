import { z } from 'zod';

import { Category } from '../readings/vocabulary';
import { NumberText, OptionalDate, TokenField, optionalChoice } from './form-field';

const priority = optionalChoice(z.enum(['more', 'standard', 'save']));

// The change form twin on the plan page. Every field may be left empty, meaning "no change";
// the priority rows exist only here, never in the change reading (D13).
export const ChangeForm = z.strictObject({
  token: TokenField,
  guests: NumberText,
  budget: NumberText,
  eventDate: OptionalDate,
  moveAmount: NumberText,
  moveTo: optionalChoice(Category),
  priorityVenue: priority,
  priorityCatering: priority,
  priorityDecor: priority,
  priorityPhoto: priority,
  priorityMusic: priority,
  priorityInvites: priority,
  priorityContingency: priority,
});
export type ChangeForm = z.infer<typeof ChangeForm>;
