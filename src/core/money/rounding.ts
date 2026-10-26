// The rounding rule of D15: amounts round to Rs 100 below Rs 1 lakh, else to Rs 1,000.
// The unit follows the budget, not the amount being rounded, so every line of one plan
// shares one unit and the lines can still be made to sum to the budget exactly.

import type { MoneyResult } from './money';
import { accept, divideRoundHalfUp, refusalFor, refuse } from './money';

export type RoundingUnit = 100 | 1000;

const ONE_LAKH = 100_000;

export function roundingUnit(budgetInr: number): MoneyResult<RoundingUnit> {
  const refusal = refusalFor(budgetInr);
  if (refusal !== null) return refuse(refusal);
  // A negative budget has no meaningful unit; the budget bounds are checked elsewhere,
  // but a silent 100 here would hide the bug that produced it.
  if (budgetInr < 0) return refuse('out-of-range');
  return accept(budgetInr < ONE_LAKH ? 100 : 1000);
}

export function roundToUnit(amountInr: number, unit: RoundingUnit): MoneyResult<number> {
  if (amountInr < 0) return refuse('out-of-range');
  const steps = divideRoundHalfUp(amountInr, unit);
  if (!steps.ok) return steps;
  const rounded = steps.value * unit;
  return Number.isSafeInteger(rounded) ? accept(rounded) : refuse('out-of-range');
}

export function roundForBudget(amountInr: number, budgetInr: number): MoneyResult<number> {
  const unit = roundingUnit(budgetInr);
  return unit.ok ? roundToUnit(amountInr, unit.value) : unit;
}
