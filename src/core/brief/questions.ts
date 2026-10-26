// The questions an unconfirmed brief leaves open. Each one names the field, a reason and what
// the person gave, so the check page can say "This date has passed; pick a date after today"
// instead of a bare error. A question never carries a default: the input it renders starts
// empty, and a value that was wrong is shown in the reason text, not pre-filled (FR-3, FR-4).

import type { Bounds } from './brief-draft';

/** The values a brief cannot be made without; the rest may stay "not sure". */
export type BriefField = 'occasion' | 'budget' | 'guests' | 'eventDate' | 'venueCapacity';

export type QuestionReason =
  /** Nothing was given. */
  | 'missing'
  /** Text that holds no number, or no occasion the app knows. */
  | 'unreadable'
  | 'several-numbers'
  | 'not-whole'
  /** A number outside the field's bounds; `bounds` says which. */
  | 'out-of-range'
  | 'date-passed'
  /** A day, month or year that is not a real date. */
  | 'date-invalid'
  /** An occasion the budget data maps to no profile (D38). */
  | 'no-profile';

export interface BriefQuestion {
  readonly field: BriefField;
  readonly reason: QuestionReason;
  /** What the person gave, for the reason text only; null when they gave nothing. */
  readonly given: string | number | null;
  readonly bounds: Bounds | null;
}

/** Display order on the check page; also the order questions are returned in. */
export const FIELD_ORDER: readonly BriefField[] = [
  'occasion',
  'budget',
  'guests',
  'eventDate',
  'venueCapacity',
];

/** The dictionary key of the reason text, e.g. `brief.question.date-passed`, in both languages. */
export function reasonKey(question: BriefQuestion): string {
  return `brief.question.${question.reason}`;
}

export function ask(
  field: BriefField,
  reason: QuestionReason,
  given: string | number | null = null,
  bounds: Bounds | null = null,
): BriefQuestion {
  return { field, reason, given, bounds };
}

/** Stable order by field, then the order the questions were raised in. */
export function inFieldOrder(questions: readonly BriefQuestion[]): BriefQuestion[] {
  return [...questions].sort((a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field));
}
