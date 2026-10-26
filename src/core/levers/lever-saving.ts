// The arithmetic of one lever on one amount, so the option list and the combined selection
// compute a saving the same way (architecture 4.5): a percent lever takes its percent of the
// category, rounded half up; half the contingency is exactly the floor of half; raising the
// budget closes the gap that is left.

import { scale } from '../money/money';
import { fail, fromMoney, succeed, type BudgetResult } from '../budget/budget-refusal';
import type { LeverRow } from './lever-types';

/**
 * `currentInr` is the category's amount now (for a percent or contingency lever) and
 * `gapInr` is the amount over budget now (for raising the budget). Never negative.
 */
export function savingInr(row: LeverRow, currentInr: number, gapInr: number): BudgetResult<number> {
  if (!Number.isSafeInteger(currentInr) || currentInr < 0) return fail('amount-invalid');
  switch (row.effect) {
    case 'percentOfCategory': {
      const part = scale({ inr: currentInr, provenance: 'computed' }, row.percent, 100);
      return part.ok ? succeed(part.value.inr) : fromMoney(part);
    }
    case 'halfContingency':
      return succeed(Math.floor(currentInr / 2));
    case 'raiseBudget':
      return succeed(Math.max(0, gapInr));
  }
}
