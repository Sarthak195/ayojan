// Turns a change reading plus the family's answers into the fields of one changeConfirmed op
// (FR-24, FR-25). Every open question must be answered first: "Apply this change" is refused
// while one is open, and an answer is accepted only if it is one of the offered choices or a
// value inside the plan's bounds, so a crafted form cannot slip a default through.

import type { IsoDate } from '@/core/calendar/day-number';
import type { Category } from '@/schemas/readings/vocabulary';

import {
  budgetAfter,
  changeQuestions,
  guestsAfter,
  inBudget,
  type ChangeQuestion,
  type ChangeValues,
  type CurrentHeadline,
} from './change-questions';

export interface ChangeAnswers {
  /** The answer to "By how much?": an offered option's amount or an exact amount. */
  readonly budgetInr: number | null;
  /** The answer to "Which date?": one of the offered dates. */
  readonly eventDate: string | null;
}

export interface ChangeFields {
  readonly guests: number | null;
  readonly budgetInr: number | null;
  readonly eventDate: string | null;
  readonly reallocate: { readonly to: Category; readonly amountInr: number } | null;
}

export type ChangeConfirmation =
  | { readonly ok: true; readonly fields: ChangeFields }
  | { readonly ok: false; readonly open: readonly ChangeQuestion[] };

// "Budget decreased: by how much?" answered with a larger budget contradicts the reading the
// family just checked, so it stays open rather than silently reversing the change.
function agrees(direction: 'increase' | 'decrease' | 'none', answer: number, now: number): boolean {
  if (direction === 'decrease') return answer < now;
  return direction === 'increase' ? answer > now : true;
}

function answered(
  question: ChangeQuestion,
  answers: ChangeAnswers,
  current: CurrentHeadline,
): boolean {
  switch (question.kind) {
    case 'budget-how-much':
      return (
        answers.budgetInr !== null &&
        inBudget(answers.budgetInr) &&
        agrees(question.direction, answers.budgetInr, current.budgetInr)
      );
    case 'which-date':
      return answers.eventDate !== null && question.candidates.includes(answers.eventDate);
    case 'nothing-to-change':
    case 'guests-unclear':
    case 'guests-out-of-range':
    case 'budget-out-of-range':
    case 'date-unclear':
    case 'date-passed':
    case 'move-unclear':
      // These are reasons to re-enter the value, not choices to make on this screen.
      return false;
  }
}

export function confirmChange(
  values: ChangeValues,
  answers: ChangeAnswers,
  current: CurrentHeadline,
  today: IsoDate,
): ChangeConfirmation {
  const open = changeQuestions(values, current, today).filter(
    (question) => !answered(question, answers, current),
  );
  if (open.length > 0) return { ok: false, open };
  const { dateCandidates, reallocate } = values;
  const eventDate = dateCandidates.length > 1 ? answers.eventDate : (dateCandidates[0] ?? null);
  const to = reallocate === null ? null : reallocate.to;
  const amountInr = reallocate === null ? null : reallocate.amountInr;
  const move = to !== null && amountInr !== null ? { to, amountInr } : null;
  return {
    ok: true,
    fields: {
      guests: guestsAfter(values, current),
      budgetInr:
        budgetAfter(values, current) ?? (values.budget === null ? null : answers.budgetInr),
      eventDate,
      reallocate: move,
    },
  };
}
