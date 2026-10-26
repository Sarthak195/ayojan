// Questions a change reading leaves open (FR-24, spec 5.2 step 2). Code turns the reading's
// relative values into absolute ones against the current plan; whatever it cannot settle, it
// asks, and it never picks an answer for the family. A budget that only "decreased a bit" gets
// "By how much?" with 5 percent, 10 percent or an exact amount; two dates that disagree get
// "Which date?"; a result outside the plan's bounds gets a question that says why.

import type { IsoDate } from '@/core/calendar/day-number';
import { resolveDayMonth, resolveShift, type DateResolution } from '@/core/calendar/relative-date';
import { BUDGET_MAX_INR, BUDGET_MIN_INR } from '@/schemas/plan/brief';
import type { PendingReading } from '@/schemas/plan/state-token';
import type { ChangeReading } from '@/schemas/readings/change-reading';

import { divideRoundHalfUp } from '../money/money';
import { roundForBudget } from '../money/rounding';

/** The reading's values without their quotes, which the grounding layer has already checked. */
export type ChangeClaims = { readonly [K in keyof ChangeReading]: Omit<ChangeReading[K], 'quote'> };

export type ChangeValues = Omit<Extract<PendingReading, { kind: 'change' }>['values'], 'sources'>;

export interface CurrentHeadline {
  readonly guests: number;
  readonly budgetInr: number;
  readonly eventDate: IsoDate;
}

export interface BudgetOption {
  readonly percent: 5 | 10;
  readonly budgetInr: number;
}

export type ChangeQuestion =
  | { readonly kind: 'nothing-to-change' }
  | { readonly kind: 'guests-unclear' }
  | { readonly kind: 'guests-out-of-range'; readonly guests: number }
  | {
      readonly kind: 'budget-how-much';
      readonly direction: 'increase' | 'decrease' | 'none';
      readonly options: readonly BudgetOption[];
      /** Always null: the form never pre-selects an option (FR-24). */
      readonly selected: null;
    }
  | { readonly kind: 'budget-out-of-range'; readonly budgetInr: number }
  | { readonly kind: 'date-unclear' }
  | { readonly kind: 'date-passed'; readonly date: string }
  | { readonly kind: 'which-date'; readonly candidates: readonly string[]; readonly selected: null }
  | { readonly kind: 'move-unclear' };

const MAX_GUESTS = 5_000;

function dateOf(resolution: DateResolution): IsoDate | null {
  return resolution.date;
}

/** Reading to pending values: relative guests stay relative here, dates become candidates. */
export function changeValuesFrom(
  claims: ChangeClaims,
  current: CurrentHeadline,
  today: IsoDate,
): { readonly values: ChangeValues; readonly unclear: readonly ('guests' | 'date' | 'move')[] } {
  const unclear: ('guests' | 'date' | 'move')[] = [];
  const { guests, budget, dateShift, dateWritten, reallocate } = claims;
  const guestValue =
    (guests.mode === 'absolute' || guests.mode === 'delta') && guests.count !== null
      ? { mode: guests.mode, count: guests.count }
      : null;
  if (guests.mode === 'unclear' || (guests.mode !== 'absent' && guests.count === null)) {
    unclear.push('guests');
  }
  const candidates: IsoDate[] = [];
  const add = (date: IsoDate | null): void => {
    if (date === null) unclear.push('date');
    else if (!candidates.includes(date)) candidates.push(date);
  };
  if (dateShift.presence === 'present' && dateShift.shiftDays !== null) {
    add(dateOf(resolveShift(current.eventDate, dateShift.shiftDays, today)));
  } else if (dateShift.presence !== 'absent') add(null);
  if (
    dateWritten.presence === 'present' &&
    dateWritten.day !== null &&
    dateWritten.month !== null
  ) {
    const { day, month, year } = dateWritten;
    add(dateOf(resolveDayMonth({ day, month, year }, today)));
  } else if (dateWritten.presence !== 'absent') add(null);
  const move =
    reallocate.presence === 'absent'
      ? null
      : { to: reallocate.to === 'unclear' ? null : reallocate.to, amountInr: reallocate.amountInr };
  if (move !== null && (move.to === null || move.amountInr === null)) unclear.push('move');
  return {
    values: {
      guests: guestValue,
      budget:
        budget.mode === 'absent'
          ? null
          : { mode: budget.mode, direction: budget.direction, amountInr: budget.amountInr },
      dateCandidates: candidates,
      reallocate: move,
    },
    unclear,
  };
}

export function guestsAfter(values: ChangeValues, current: CurrentHeadline): number | null {
  if (values.guests === null) return null;
  return values.guests.mode === 'absolute'
    ? values.guests.count
    : current.guests + values.guests.count;
}

export function budgetAfter(values: ChangeValues, current: CurrentHeadline): number | null {
  const { budget } = values;
  if (budget === null) return null;
  if (budget.amountInr === null || budget.mode === 'directionOnly') return null;
  if (budget.mode === 'absolute') return budget.amountInr;
  if (budget.direction === 'none') return null;
  const sign = budget.direction === 'decrease' ? -1 : 1;
  return current.budgetInr + sign * budget.amountInr;
}

function budgetOptions(
  direction: 'increase' | 'decrease' | 'none',
  current: number,
): BudgetOption[] {
  if (direction === 'none') return [];
  const options: BudgetOption[] = [];
  for (const percent of [5, 10] as const) {
    const factor = direction === 'decrease' ? 100 - percent : 100 + percent;
    const exact = divideRoundHalfUp(current * factor, 100);
    const rounded = exact.ok ? roundForBudget(exact.value, current) : exact;
    if (rounded.ok && rounded.value >= BUDGET_MIN_INR && rounded.value <= BUDGET_MAX_INR) {
      options.push({ percent, budgetInr: rounded.value });
    }
  }
  return options;
}

export function inBudget(inr: number): boolean {
  return Number.isSafeInteger(inr) && inr >= BUDGET_MIN_INR && inr <= BUDGET_MAX_INR;
}

/** Every question the values leave open, in the order the check screen shows them. */
export function changeQuestions(
  values: ChangeValues,
  current: CurrentHeadline,
  today: IsoDate,
): readonly ChangeQuestion[] {
  const { guests, budget, dateCandidates, reallocate } = values;
  if (guests === null && budget === null && dateCandidates.length === 0 && reallocate === null) {
    return [{ kind: 'nothing-to-change' }];
  }
  const questions: ChangeQuestion[] = [];
  const guestCount = guestsAfter(values, current);
  if (guestCount !== null && (guestCount < 1 || guestCount > MAX_GUESTS)) {
    questions.push({ kind: 'guests-out-of-range', guests: guestCount });
  }
  const budgetInr = budgetAfter(values, current);
  if (budget !== null && budgetInr === null) {
    questions.push({
      kind: 'budget-how-much',
      direction: budget.direction,
      options: budgetOptions(budget.direction, current.budgetInr),
      selected: null,
    });
  } else if (budgetInr !== null && !inBudget(budgetInr)) {
    questions.push({ kind: 'budget-out-of-range', budgetInr });
  }
  const passed = dateCandidates.find((date) => date <= today);
  if (passed !== undefined) {
    questions.push({ kind: 'date-passed', date: passed });
  } else if (dateCandidates.length > 1) {
    questions.push({ kind: 'which-date', candidates: dateCandidates, selected: null });
  }
  if (
    reallocate !== null &&
    (reallocate.to === null || reallocate.amountInr === null || reallocate.amountInr < 1)
  ) {
    questions.push({ kind: 'move-unclear' });
  }
  return questions;
}
