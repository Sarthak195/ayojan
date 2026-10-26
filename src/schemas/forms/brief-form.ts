import { z } from 'zod';

import { FunctionAnswer } from '../plan/brief';
import { Diet, GuestNeed, MustHave, VenueLimit } from '../readings/vocabulary';
import { NumberText, OptionalDate, listOf } from './form-field';

export const PriorityChoice = z.enum(['more', 'standard', 'save']);

// The brief form twin (/[lang]/form): the same values the brief reading yields, typed by hand.
// Field names are flat because a urlencoded body has no nesting.
export const BriefForm = z.strictObject({
  occasion: z.enum(['wedding', 'other']),
  budget: NumberText,
  guests: NumberText,
  eventDate: OptionalDate,
  venueCapacity: NumberText,
  functionHaldi: FunctionAnswer,
  functionMehndi: FunctionAnswer,
  functionSangeet: FunctionAnswer,
  functionWedding: FunctionAnswer,
  functionReception: FunctionAnswer,
  priorityVenue: PriorityChoice,
  priorityCatering: PriorityChoice,
  priorityDecor: PriorityChoice,
  priorityPhoto: PriorityChoice,
  priorityMusic: PriorityChoice,
  priorityInvites: PriorityChoice,
  priorityContingency: PriorityChoice,
  mustHave: listOf(MustHave, 4),
  need: listOf(GuestNeed, 3),
  diet: listOf(Diet, 3),
  venueLimit: listOf(VenueLimit, 2),
});
export type BriefForm = z.infer<typeof BriefForm>;
