// Splits the user's own budget once, at the brief (architecture 4.1, D09, D15, D38).
// Integer arithmetic only: weights are integers, multipliers are integer percents, and every
// division goes through the shared half-up helper, so the same brief gives the same split on
// every runtime and the amounts sum to the budget to the rupee.

import { BUDGET_MAX_INR, BUDGET_MIN_INR } from '@/schemas/plan/brief';
import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';
import type { Category, Occasion, Priority } from '@/schemas/readings/vocabulary';

import { fail, fromMoney, succeed, type BudgetResult } from './budget-refusal';
import {
  floorInr,
  profileForOccasion,
  type BudgetProfile,
  type CategoryWeight,
} from './budget-profile';
import { categoryRecord } from './category-record';
import type { FrozenSplit, SplitLine } from './frozen-split';
import { divideRoundHalfUp, refusalFor } from '../money/money';
import { roundingUnit } from '../money/rounding';

export interface AllocationInput {
  readonly occasion: Occasion;
  readonly budgetInr: number;
  /** The brief's guest count, kept as g_alloc for the per-guest scaling. */
  readonly guests: number;
  readonly priorities: Readonly<Record<Category, Priority>>;
}

function multiplierFor(weights: BudgetWeightsFile, priority: Priority): number | null {
  return weights.multipliers.find((row) => row.priority === priority)?.percent ?? null;
}

// Each category's weight is base x multiplier percent, so the weights stay integers and the
// normalising divisor is their sum (the contingency weight counts in it).
function effectiveWeights(
  profile: BudgetProfile,
  weights: BudgetWeightsFile,
  priorities: AllocationInput['priorities'],
): BudgetResult<readonly number[]> {
  const result: number[] = [];
  for (const row of profile.categories) {
    const percent = multiplierFor(weights, priorities[row.category]);
    if (percent === null) return fail('priority-without-multiplier');
    result.push(row.baseWeight * percent);
  }
  return succeed(result);
}

function validated(input: AllocationInput): BudgetResult<null> {
  const budgetRefusal = refusalFor(input.budgetInr);
  if (budgetRefusal !== null) return fail(budgetRefusal);
  if (input.budgetInr < BUDGET_MIN_INR || input.budgetInr > BUDGET_MAX_INR) {
    return fail('budget-out-of-range');
  }
  const guestsRefusal = refusalFor(input.guests);
  if (guestsRefusal !== null) return fail(guestsRefusal);
  // g_alloc is a divisor later, so a brief with no guests never gets a split.
  return input.guests < 1 ? fail('guests-out-of-range') : succeed(null);
}

// Contingency absorbs the rounding remainder, so it can end up under its floor. The largest
// other categories then each give back one rounding unit, biggest first, until it holds.
function restoreContingencyFloor(
  amounts: number[],
  rows: readonly CategoryWeight[],
  contingencyIndex: number,
  budgetInr: number,
  unit: number,
): boolean {
  const contingencyRow = rows[contingencyIndex];
  if (contingencyRow === undefined) return false;
  const minimum = (inr: number): number => floorInr(contingencyRow.floor, inr, budgetInr);
  const others = amounts.map((_, index) => index).filter((index) => index !== contingencyIndex);
  while ((amounts[contingencyIndex] ?? 0) < minimum(amounts[contingencyIndex] ?? 0)) {
    let largest: number | null = null;
    for (const index of others) {
      const here = amounts[index] ?? 0;
      if (here >= unit && (largest === null || here > (amounts[largest] ?? 0))) largest = index;
    }
    if (largest === null) return false;
    amounts[largest] = (amounts[largest] ?? 0) - unit;
    amounts[contingencyIndex] = (amounts[contingencyIndex] ?? 0) + unit;
  }
  return true;
}

function roundedAmounts(
  rows: readonly CategoryWeight[],
  shares: readonly number[],
  budgetInr: number,
  unit: number,
): BudgetResult<number[]> {
  const total = shares.reduce((sum, share) => sum + share, 0);
  const amounts: number[] = [];
  let others = 0;
  for (const [index, row] of rows.entries()) {
    if (row.category === 'contingency') {
      amounts.push(0);
      continue;
    }
    // One division by (total x unit) rounds once, where rounding to rupees first and then to
    // the unit could tip a near-tie the wrong way.
    const steps = divideRoundHalfUp(budgetInr * (shares[index] ?? 0), total * unit);
    if (!steps.ok) return fromMoney(steps);
    amounts.push(steps.value * unit);
    others += steps.value * unit;
  }
  const contingencyIndex = rows.findIndex((row) => row.category === 'contingency');
  if (contingencyIndex < 0) return fail('profile-incomplete');
  amounts[contingencyIndex] = budgetInr - others;
  return restoreContingencyFloor(amounts, rows, contingencyIndex, budgetInr, unit)
    ? succeed(amounts)
    : fail('profile-incomplete');
}

function toSplit(
  profile: BudgetProfile,
  amounts: readonly number[],
  input: AllocationInput,
  unit: FrozenSplit['roundingUnitInr'],
): BudgetResult<FrozenSplit> {
  const lineFor = (category: Category): SplitLine | undefined => {
    const index = profile.categories.findIndex((row) => row.category === category);
    const row = profile.categories[index];
    if (row === undefined) return undefined;
    return {
      category,
      allocation: { inr: amounts[index] ?? 0, provenance: 'your-split' },
      perGuestSharePercent: row.perGuestSharePercent,
      floor: row.floor,
    };
  };
  // The data validator makes every profile name all seven categories once; this keeps a
  // hand-built profile in a test from yielding a split with a hole in it.
  const lines = categoryRecord(lineFor);
  if (lines === null) return fail('profile-incomplete');
  return succeed({
    profile: profile.id,
    roundingUnitInr: unit,
    budgetAtSplit: { inr: input.budgetInr, provenance: 'your-number' },
    guestsAtSplit: input.guests,
    order: profile.categories.map((row) => row.category),
    lines,
  });
}

export function allocateBudget(
  input: AllocationInput,
  weights: BudgetWeightsFile,
): BudgetResult<FrozenSplit> {
  const checked = validated(input);
  if (!checked.ok) return checked;
  const profile = profileForOccasion(weights, input.occasion);
  if (!profile.ok) return profile;
  const shares = effectiveWeights(profile.value, weights, input.priorities);
  if (!shares.ok) return shares;
  const unit = roundingUnit(input.budgetInr);
  if (!unit.ok) return fromMoney(unit);
  const amounts = roundedAmounts(
    profile.value.categories,
    shares.value,
    input.budgetInr,
    unit.value,
  );
  return amounts.ok ? toSplit(profile.value, amounts.value, input, unit.value) : amounts;
}
