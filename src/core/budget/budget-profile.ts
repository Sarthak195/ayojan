// The budget data, narrowed to what the engines need. The shapes come from the data schema,
// so a field added to budget-weights.yaml reaches this module through the type checker.

import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';
import type { Occasion } from '@/schemas/readings/vocabulary';

import { fail, succeed, type BudgetResult } from './budget-refusal';

export type BudgetProfile = BudgetWeightsFile['profiles'][number];
export type CategoryWeight = BudgetProfile['categories'][number];
export type FloorRule = CategoryWeight['floor'];
export type ProfileId = BudgetProfile['id'];

/** The profile whose occasion list names this occasion; the data validator guarantees one. */
export function profileForOccasion(
  weights: BudgetWeightsFile,
  occasion: Occasion,
): BudgetResult<BudgetProfile> {
  const profile = weights.profiles.find((row) => row.occasions.includes(occasion));
  return profile === undefined ? fail('no-profile-for-occasion') : succeed(profile);
}

/**
 * The lowest amount a category may be taken down to. It rounds up, so a floor is never
 * crossed by a fraction of a rupee: 50 percent of an odd allocation keeps the larger half.
 */
export function floorInr(rule: FloorRule, allocationInr: number, budgetInr: number): number {
  const base = rule.of === 'budget' ? budgetInr : allocationInr;
  return Math.ceil((base * rule.percent) / 100);
}
