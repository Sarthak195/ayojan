// Every budget function answers with a typed result instead of throwing: a bad input from a
// form or a link must become a question for the user, never a 500 (12-requirements 4.2.1).

import type { MoneyRefusal, MoneyResult } from '../money/money';

export type BudgetRefusal =
  | MoneyRefusal
  | 'budget-out-of-range'
  | 'guests-out-of-range'
  | 'amount-invalid'
  | 'no-profile-for-occasion'
  | 'profile-incomplete'
  | 'priority-without-multiplier';

export type BudgetResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: BudgetRefusal };

export function succeed<T>(value: T): BudgetResult<T> {
  return { ok: true, value };
}

export function fail<T>(reason: BudgetRefusal): BudgetResult<T> {
  return { ok: false, reason };
}

/** Lifts a money-arithmetic result so its refusal travels with the budget refusals. */
export function fromMoney<T>(result: MoneyResult<T>): BudgetResult<T> {
  return result.ok ? succeed(result.value) : fail(result.reason);
}
