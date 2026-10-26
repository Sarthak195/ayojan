// Move money (architecture 4.4, D12): "move Rs X to T" raises T's allocation by X.
// The part covered by headroom needs no giver. The rest comes from givers' allocation
// rupees, the save tier first and then the standard tier, each in data order, each down to
// its floor. Whatever the givers cannot cover is NOT cut from anywhere: it stays in the
// target's allocation and shows as over budget.

import type { Category, Priority } from '@/schemas/readings/vocabulary';

import { fail, succeed, type BudgetResult } from './budget-refusal';
import { floorInr } from './budget-profile';
import { currentAllocationInr, type AllocationDeltas, type FrozenSplit } from './frozen-split';
import {
  giverBlock,
  giverTier,
  type GiverBlock,
  type GiverContext,
  type GiverTier,
} from './giver-eligibility';
import type { Money } from '../money/money';
import type { Projection } from './projection';

export interface MoveMoneyInput {
  readonly split: FrozenSplit;
  /** Moves already applied; the new move builds on them. */
  readonly deltas: AllocationDeltas;
  /** The current view, including booked, quoted and lever-adjusted categories. */
  readonly projection: Projection;
  readonly priorities: Readonly<Record<Category, Priority>>;
  readonly mustHaveCategories: readonly Category[];
  readonly target: Category;
  readonly amountInr: number;
}

export interface Giver {
  readonly category: Category;
  readonly amount: Money;
  readonly reason: 'save-tier' | 'standard-tier';
}

export interface SkippedGiver {
  readonly category: Category;
  readonly reason: GiverBlock | 'at-floor';
}

export interface MoveMoneyOutcome {
  readonly target: Category;
  readonly requested: Money;
  readonly fromHeadroom: Money;
  readonly givers: readonly Giver[];
  /** The part nobody could give: the plan shows it as over budget. */
  readonly shortfall: Money;
  /** Categories that were not asked to give, and why, for the "why not" line. */
  readonly skipped: readonly SkippedGiver[];
  /** The deltas after this move, to store and to pass to the next projection. */
  readonly deltas: AllocationDeltas;
}

function computed(inr: number): Money {
  return { inr, provenance: 'computed' };
}

interface TierState {
  remaining: number;
  readonly givers: Giver[];
  readonly skipped: SkippedGiver[];
  readonly moved: Partial<Record<Category, number>>;
}

function drawFromTier(
  input: MoveMoneyInput,
  context: GiverContext,
  tier: GiverTier,
  state: TierState,
): void {
  const { split, projection } = input;
  for (const category of split.order) {
    if (giverTier(input.priorities[category]) !== tier) continue;
    if (giverBlock(context, category) !== null) continue;
    // The floor is read from the frozen allocation (or the current budget for contingency),
    // while what can be given is measured from today's allocation, moves included.
    const frozen = split.lines[category];
    const floor = floorInr(frozen.floor, frozen.allocation.inr, projection.budget.inr);
    const available = Math.max(0, currentAllocationInr(split, input.deltas, category) - floor);
    const given = Math.min(available, state.remaining);
    if (available === 0) state.skipped.push({ category, reason: 'at-floor' });
    if (given === 0) continue;
    state.remaining -= given;
    state.moved[category] = given;
    state.givers.push({
      category,
      amount: computed(given),
      reason: tier === 'save' ? 'save-tier' : 'standard-tier',
    });
  }
}

export function moveMoney(input: MoveMoneyInput): BudgetResult<MoveMoneyOutcome> {
  const { amountInr } = input;
  if (!Number.isSafeInteger(amountInr) || amountInr < 0) return fail('amount-invalid');
  const context: GiverContext = {
    target: input.target,
    priorities: input.priorities,
    projection: input.projection,
    mustHaveCategories: input.mustHaveCategories,
  };
  const fromHeadroom = Math.min(amountInr, input.projection.headroom.inr);
  const state: TierState = {
    remaining: amountInr - fromHeadroom,
    givers: [],
    skipped: [],
    moved: {},
  };
  drawFromTier(input, context, 'save', state);
  drawFromTier(input, context, 'standard', state);
  for (const category of input.split.order) {
    const block = giverBlock(context, category);
    if (block !== null) state.skipped.push({ category, reason: block });
  }
  const deltas: Partial<Record<Category, number>> = { ...input.deltas };
  if (amountInr > 0) deltas[input.target] = (deltas[input.target] ?? 0) + amountInr;
  for (const giver of state.givers) {
    deltas[giver.category] = (deltas[giver.category] ?? 0) - giver.amount.inr;
  }
  return succeed({
    target: input.target,
    requested: { inr: amountInr, provenance: 'your-number' },
    fromHeadroom: computed(fromHeadroom),
    givers: state.givers,
    shortfall: computed(state.remaining),
    skipped: state.skipped,
    deltas,
  });
}
