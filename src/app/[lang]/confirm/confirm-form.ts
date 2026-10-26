import 'server-only';

import type { z } from 'zod';

import type { BriefAnswers } from '@/core/brief/brief-draft';
import { CheckConfirm } from '@/schemas/forms/check-confirm';
import { listOf } from '@/schemas/forms/form-field';
import { FunctionAnswer } from '@/schemas/plan/brief';
import {
  Diet,
  GuestNeed,
  MustHave,
  Occasion,
  Priority,
  VenueLimit,
} from '@/schemas/readings/vocabulary';

import { QUOTE_CONFIRM_FIELDS } from '../p/[token]/quotes/_quote/quote-fields';

// The check page's brief rows on top of the shared confirm fields: the occasion picker (D38)
// and the function, priority and list rows of spec 6.3. Field names match the form twin's
// (BriefForm), so one set of names covers both pages. Every row is optional because the
// same route confirms quote and change readings, whose pages carry none of them.
export const ConfirmForm = CheckConfirm.extend({
  occasion: Occasion.optional(),
  functionHaldi: FunctionAnswer.optional(),
  functionMehndi: FunctionAnswer.optional(),
  functionSangeet: FunctionAnswer.optional(),
  functionWedding: FunctionAnswer.optional(),
  functionReception: FunctionAnswer.optional(),
  priorityVenue: Priority.optional(),
  priorityCatering: Priority.optional(),
  priorityDecor: Priority.optional(),
  priorityPhoto: Priority.optional(),
  priorityMusic: Priority.optional(),
  priorityInvites: Priority.optional(),
  priorityContingency: Priority.optional(),
  mustHave: listOf(MustHave, 4),
  need: listOf(GuestNeed, 3),
  diet: listOf(Diet, 3),
  venueLimit: listOf(VenueLimit, 2),
}).extend(QUOTE_CONFIRM_FIELDS);
export type ConfirmForm = z.infer<typeof ConfirmForm>;

// A row missing from the post keeps the reading's answer, because core reads an absent key
// as "not on the page"; an undefined value would not type-check as an answer.
function answered<K extends string, V>(
  row: Readonly<Record<K, V | undefined>>,
): Partial<Record<K, V>> {
  const found: Partial<Record<K, V>> = {};
  for (const key of Object.keys(row) as K[]) {
    const value = row[key];
    if (value !== undefined) found[key] = value;
  }
  return found;
}

/**
 * The page's answers for the brief resolver. The check page always shows the list rows, so an
 * empty list means "none ticked"; scalar fields arrive as typed text, blank meaning "left
 * empty", which core turns into a question, never a zero.
 */
export function briefAnswersOf(form: ConfirmForm): BriefAnswers {
  return {
    occasion: form.occasion,
    budget: form.budget,
    guests: form.guests,
    eventDate: form.eventDate,
    venueCapacity: form.venueCapacity,
    functions: answered({
      haldi: form.functionHaldi,
      mehndi: form.functionMehndi,
      sangeet: form.functionSangeet,
      wedding: form.functionWedding,
      reception: form.functionReception,
    }),
    priorities: answered({
      venue: form.priorityVenue,
      catering: form.priorityCatering,
      decor: form.priorityDecor,
      photo: form.priorityPhoto,
      music: form.priorityMusic,
      invites: form.priorityInvites,
      contingency: form.priorityContingency,
    }),
    mustHaves: form.mustHave,
    needs: form.need,
    diet: form.diet,
    venueLimits: form.venueLimit,
  };
}
