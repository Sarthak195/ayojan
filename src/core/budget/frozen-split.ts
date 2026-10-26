// The split of the user's budget across categories, fixed when the brief is confirmed (D09).
// Nothing here has a setter: a later change of budget, guests or priorities shows up as a
// gap in the projection, and only Move money (reallocation.ts) shifts rupees, as deltas that
// sit beside the frozen amounts instead of replacing them.

import type { Category } from '@/schemas/readings/vocabulary';

import type { Money } from '../money/money';
import type { RoundingUnit } from '../money/rounding';
import type { FloorRule, ProfileId } from './budget-profile';

export interface SplitLine {
  readonly category: Category;
  /** The allocation at the brief, your-split provenance. */
  readonly allocation: Money;
  readonly perGuestSharePercent: number;
  readonly floor: FloorRule;
}

export interface FrozenSplit {
  readonly profile: ProfileId;
  readonly roundingUnitInr: RoundingUnit;
  readonly budgetAtSplit: Money;
  /** g_alloc: the guest count the allocation was made for, never zero. */
  readonly guestsAtSplit: number;
  /** Data order, which is also the order Move money tries its givers in. */
  readonly order: readonly Category[];
  readonly lines: Readonly<Record<Category, SplitLine>>;
}

/** Signed rupees added to a frozen allocation by Move money; absent means no move. */
export type AllocationDeltas = Readonly<Partial<Record<Category, number>>>;

export function currentAllocationInr(
  split: FrozenSplit,
  deltas: AllocationDeltas,
  category: Category,
): number {
  return split.lines[category].allocation.inr + (deltas[category] ?? 0);
}
