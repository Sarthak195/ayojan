// Every plan function answers with a typed result instead of throwing: a crafted link or a stale
// form must become a page that says what went wrong, never a 500 (12-requirements 4.2.1).

import type { BudgetRefusal } from '../budget/budget-refusal';
import type { QuoteRefusal } from '../quotes/quote-types';
import type { ScheduleProblem } from '../timeline/schedule-types';

/** Why one op cannot join the plan; the route maps each to a 422 page. */
export type ApplyRefusal =
  | 'op-cap'
  | 'no-brief'
  | 'brief-already-confirmed'
  | 'quote-limit'
  | 'quote-slot-taken'
  | 'unknown-task'
  | 'inactive-task'
  | 'task-already-done'
  | 'amount-on-task-without-booking'
  | 'capacity-on-task-without-venue'
  | 'amount-invalid'
  | 'empty-change'
  | 'budget-out-of-range'
  | 'guests-out-of-range'
  | 'no-levers'
  | 'unknown-lever'
  | 'lever-disabled'
  | 'raise-without-amount'
  | 'amount-without-raise'
  | 'date-invalid';

export type PlanRefusal =
  | { readonly kind: 'apply'; readonly reason: ApplyRefusal; readonly opIndex: number }
  | { readonly kind: 'budget'; readonly reason: BudgetRefusal }
  | { readonly kind: 'quotes'; readonly reason: QuoteRefusal }
  | { readonly kind: 'schedule'; readonly problem: ScheduleProblem };

export type PlanResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly refusal: PlanRefusal };

export function planOk<T>(value: T): PlanResult<T> {
  return { ok: true, value };
}

export function planFail<T>(refusal: PlanRefusal): PlanResult<T> {
  return { ok: false, refusal };
}

export function applyFail<T>(reason: ApplyRefusal, opIndex: number): PlanResult<T> {
  return planFail({ kind: 'apply', reason, opIndex });
}

export function budgetFail<T>(reason: BudgetRefusal): PlanResult<T> {
  return planFail({ kind: 'budget', reason });
}

export function quotesFail<T>(reason: QuoteRefusal): PlanResult<T> {
  return planFail({ kind: 'quotes', reason });
}
