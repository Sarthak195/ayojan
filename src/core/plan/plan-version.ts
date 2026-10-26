// One version of the plan, every number derived from its ops, the data and `today`. The plan
// view computes the current version once per request, plus the version before the latest
// change when the revision page needs it (D32), and the diff compares two of these.

import type { IsoDate } from '@/core/calendar/day-number';
import type { LeverId } from '@/schemas/generated/ids';
import type { Brief } from '@/schemas/plan/brief';
import type { QuoteRecord } from '@/schemas/plan/quote-record';
import type { Category, Priority } from '@/schemas/readings/vocabulary';

import { allocateBudget } from '../budget/allocation';
import type { ProfileId } from '../budget/budget-profile';
import { categoriesTiedToMustHaves } from '../budget/must-have-categories';
import type { Projection, ProjectionInput } from '../budget/projection';
import type { SkippedLever } from '../levers/lever-application';
import { leverOptions } from '../levers/lever-options';
import type { LeverOption } from '../levers/lever-types';
import type { Money } from '../money/money';
import type { Comparison } from '../quotes/comparison';
import { requirementsFrom } from '../quotes/quote-types';
import type { CheapestQuote } from '../quotes/ranking';
import type { DelayPropagation } from '../timeline/schedule-change';
import type { Schedule } from '../timeline/schedule-types';
import type { Booking } from '../timeline/task-progress';
import { resolveTask } from '../timeline/task-selection';
import type { PlanData } from './plan-data';
import { venueCapacityOf, type VenueCapacity } from './plan-evidence';
import type { PlanInputs } from './plan-inputs';
import { leveredPlan, walkMoney, type MoveRecord, type WalkContext } from './plan-money';
import { planComparisons } from './plan-quotes';
import { budgetFail, planOk, type PlanResult } from './plan-refusal';
import { planTimeline } from './plan-timeline';

export interface AppliedLeverLine {
  readonly id: LeverId;
  readonly category: Category | null;
  /** Rupees saved; for raising the budget, the rupees added to it. */
  readonly effect: Money;
}

export interface PlanHeadline {
  readonly budget: Money;
  readonly guests: number;
  readonly eventDate: IsoDate;
  readonly venue: VenueCapacity;
  readonly projected: Money;
  /** Projected minus budget: positive is over budget. */
  readonly gap: Money;
  readonly status: Projection['status'];
}

export interface PlanMoney {
  /** The lever-free projection input after every move, for a lever preview to start from. */
  readonly input: ProjectionInput;
  /** The plan before levers. Lever options and savings are measured on this one. */
  readonly baseline: Projection;
  /** The plan after levers: the figures every page shows. */
  readonly projection: Projection;
  readonly applied: readonly AppliedLeverLine[];
  readonly skipped: readonly SkippedLever[];
  readonly options: readonly LeverOption[];
  readonly moves: readonly MoveRecord[];
  readonly cheapest: Readonly<Partial<Record<Category, CheapestQuote>>>;
}

export interface PlanVersion {
  /** How many ops this version folds; version 1 is the brief alone. */
  readonly version: number;
  readonly brief: Brief;
  readonly profile: ProfileId;
  readonly priorities: Readonly<Record<Category, Priority>>;
  readonly headline: PlanHeadline;
  readonly money: PlanMoney;
  readonly quotes: readonly QuoteRecord[];
  readonly comparisons: readonly Comparison[];
  readonly bookings: readonly Booking[];
  readonly schedule: Schedule;
  readonly delayEffects: readonly DelayPropagation[];
  readonly leverIds: readonly LeverId[];
}

function appliedLines(
  data: PlanData,
  applied: readonly { readonly id: string; readonly saving: Money }[],
  leverIds: readonly LeverId[],
  raisedInr: number,
): AppliedLeverLine[] {
  const lines: AppliedLeverLine[] = [];
  for (const id of leverIds) {
    const row = data.levers.levers.find((lever) => lever.id === id);
    if (row === undefined) continue;
    if (row.effect === 'raiseBudget') {
      lines.push({ id, category: null, effect: { inr: raisedInr, provenance: 'your-number' } });
      continue;
    }
    const found = applied.find((lever) => lever.id === id);
    if (found !== undefined) lines.push({ id, category: row.category, effect: found.saving });
  }
  return lines;
}

export function planVersion(
  inputs: PlanInputs,
  data: PlanData,
  today: IsoDate,
): PlanResult<PlanVersion> {
  const { brief } = inputs;
  const split = allocateBudget(brief, data.budgetWeights);
  if (!split.ok) return budgetFail(split.reason);
  const context: WalkContext = {
    split: split.value,
    data,
    tasks: inputs.selection.active.map((row) => resolveTask(row, false)),
    requirements: requirementsFrom(brief.mustHaves),
    mustHaveCategories: categoriesTiedToMustHaves(brief.mustHaves, data.tasks.tasks),
  };
  const walk = walkMoney(inputs, context);
  if (!walk.ok) return walk;
  const levered = leveredPlan(walk.value, context);
  if (!levered.ok) return levered;
  const { application, evidence, input } = levered.value;
  const options = leverOptions(
    { levers: data.levers.levers, priorities: walk.value.priorities, mustHaves: brief.mustHaves },
    application.base,
  );
  if (!options.ok) return budgetFail(options.reason);
  const timeline = planTimeline(
    inputs,
    { eventDate: walk.value.eventDate, today, fasterTaskIds: application.fasterTaskIds },
    data,
  );
  if (!timeline.ok) return timeline;
  const comparisons = planComparisons(
    walk.value.quotes,
    application.projection,
    context.requirements,
  );
  if (!comparisons.ok) return comparisons;
  const raisedInr = walk.value.raises.reduce((total, raise) => total + raise.amountInr, 0);
  const { projection } = application;
  return planOk({
    version: inputs.ops.length,
    brief,
    profile: inputs.profile,
    priorities: walk.value.priorities,
    headline: {
      budget: projection.budget,
      guests: walk.value.guests,
      eventDate: walk.value.eventDate,
      venue: venueCapacityOf(walk.value.done, context.tasks, brief.venueCapacity),
      projected: projection.projectedTotal,
      gap: projection.gap,
      status: projection.status,
    },
    money: {
      input,
      baseline: application.base,
      projection,
      applied: appliedLines(data, application.applied, inputs.leverIds, raisedInr),
      skipped: application.skipped,
      options: options.value,
      moves: walk.value.moves,
      cheapest: evidence.cheapest,
    },
    quotes: walk.value.quotes,
    comparisons: comparisons.value,
    bookings: evidence.bookings,
    schedule: timeline.value.schedule,
    delayEffects: timeline.value.delayEffects,
    leverIds: inputs.leverIds,
  });
}
