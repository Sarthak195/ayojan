// The money side of the fold, walked in ledger order (architecture 4.2, 4.4, D09, D12, D13).
// The split is frozen at the brief. Each change sets the guests, the budget, the date and the
// priorities; a Move money step inside it is computed against the plan as it stood at that op,
// after the levers chosen so far, and its deltas are chained into every later step. Levers are
// applied last, on top of every move, so their savings are always recomputed for today's plan.

import { parseIsoDate, type IsoDate } from '@/core/calendar/day-number';
import type { LeverId } from '@/schemas/generated/ids';
import type { QuoteRecord } from '@/schemas/plan/quote-record';
import type { Category, Priority } from '@/schemas/readings/vocabulary';

import type { AllocationDeltas, FrozenSplit } from '../budget/frozen-split';
import type { ProjectionInput } from '../budget/projection';
import { moveMoney, type MoveMoneyOutcome } from '../budget/reallocation';
import { applyLevers, type LeverApplication } from '../levers/lever-application';
import type { DoneRecord } from '../timeline/schedule-types';
import { evidenceFor, type EvidenceContext, type PlanEvidence } from './plan-evidence';
import { leversInDataOrder, type PlanData } from './plan-data';
import type { ChangeOp, PlanInputs } from './plan-inputs';
import { applyFail, budgetFail, planOk, type PlanResult } from './plan-refusal';

export const RAISE_BUDGET_ID: LeverId = 'raise-budget';

export interface MoveRecord {
  /** The changeConfirmed op that asked for the move. */
  readonly opIndex: number;
  readonly outcome: MoveMoneyOutcome;
}

/** The guest count and date a vendor agreed to: when it quoted, or when it was booked. */
export interface AgreedTerms {
  readonly guests: number;
  readonly eventDate: IsoDate;
}

export interface RaiseRecord {
  readonly opIndex: number;
  readonly amountInr: number;
}

/** The plan's inputs as they stand after the last op. */
export interface MoneyWalk {
  readonly guests: number;
  /** The family's current budget, including any raise chosen as a lever since the last change. */
  readonly budgetInr: number;
  readonly eventDate: IsoDate;
  /** The brief's priorities, replaced by each change that carries priorities (D13). */
  readonly priorities: Readonly<Record<Category, Priority>>;
  readonly deltas: AllocationDeltas;
  readonly quotes: readonly QuoteRecord[];
  readonly done: readonly DoneRecord[];
  /** Chosen levers that change a category, in data order; raising the budget is held apart. */
  readonly leverIds: readonly LeverId[];
  readonly raises: readonly RaiseRecord[];
  readonly moves: readonly MoveRecord[];
  /** By quote slot and by task id; a later mark of the same task replaces the earlier terms. */
  readonly agreed: {
    readonly quotes: Readonly<Record<string, AgreedTerms>>;
    readonly tasks: Readonly<Record<string, AgreedTerms>>;
  };
}

export interface WalkContext extends EvidenceContext {
  readonly split: FrozenSplit;
  readonly data: PlanData;
  readonly mustHaveCategories: readonly Category[];
}

export interface LeveredPlan {
  readonly evidence: PlanEvidence;
  /** The lever-free input after every move: what a lever preview starts from. */
  readonly input: ProjectionInput;
  readonly application: LeverApplication;
}

/** Projects the walk as it stands: evidence, every move, then the chosen levers. */
export function leveredPlan(walk: MoneyWalk, context: WalkContext): PlanResult<LeveredPlan> {
  const evidence = evidenceFor(walk, context);
  if (!evidence.ok) return evidence;
  const input: ProjectionInput = {
    split: context.split,
    deltas: walk.deltas,
    guestsNow: walk.guests,
    budgetNowInr: walk.budgetInr,
    evidence: evidence.value.evidence,
  };
  const application = applyLevers({
    base: input,
    levers: context.data.levers.levers,
    selected: walk.leverIds,
  });
  if (!application.ok) return budgetFail(application.reason);
  return planOk({ evidence: evidence.value, input, application: application.value });
}

function applyChange(
  walk: MoneyWalk,
  op: ChangeOp,
  index: number,
  context: WalkContext,
): PlanResult<MoneyWalk> {
  const date = op.eventDate === null ? null : parseIsoDate(op.eventDate);
  if (date !== null && !date.ok) return applyFail('date-invalid', index);
  const changed: MoneyWalk = {
    ...walk,
    guests: op.guests ?? walk.guests,
    budgetInr: op.budgetInr ?? walk.budgetInr,
    eventDate: date === null ? walk.eventDate : date.value,
    priorities: op.priorities ?? walk.priorities,
  };
  if (op.reallocate === null) return planOk(changed);
  const now = leveredPlan(changed, context);
  if (!now.ok) return now;
  const outcome = moveMoney({
    split: context.split,
    deltas: changed.deltas,
    projection: now.value.application.projection,
    priorities: changed.priorities,
    mustHaveCategories: context.mustHaveCategories,
    target: op.reallocate.to,
    amountInr: op.reallocate.amountInr,
  });
  if (!outcome.ok) return budgetFail(outcome.reason);
  return planOk({
    ...changed,
    deltas: outcome.value.deltas,
    moves: [...changed.moves, { opIndex: index, outcome: outcome.value }],
  });
}

export function walkMoney(inputs: PlanInputs, context: WalkContext): PlanResult<MoneyWalk> {
  const eventDate = parseIsoDate(inputs.brief.eventDate);
  if (!eventDate.ok) return applyFail('date-invalid', 0);
  let walk: MoneyWalk = {
    guests: inputs.brief.guests,
    budgetInr: inputs.brief.budgetInr,
    eventDate: eventDate.value,
    priorities: inputs.brief.priorities,
    deltas: {},
    quotes: [],
    done: [],
    agreed: { quotes: {}, tasks: {} },
    leverIds: [],
    raises: [],
    moves: [],
  };
  for (const [index, op] of inputs.ops.entries()) {
    const terms: AgreedTerms = { guests: walk.guests, eventDate: walk.eventDate };
    if (op.kind === 'quoteAdded') {
      const quotes = { ...walk.agreed.quotes, [op.quote.id]: terms };
      walk = { ...walk, quotes: [...walk.quotes, op.quote], agreed: { ...walk.agreed, quotes } };
    }
    if (op.kind === 'taskDone') {
      const on = parseIsoDate(op.on);
      if (!on.ok) return applyFail('date-invalid', index);
      const record = {
        taskId: op.taskId,
        on: on.value,
        amountInr: op.amountInr,
        capacity: op.capacity,
      };
      const tasks = { ...walk.agreed.tasks, [op.taskId]: terms };
      walk = { ...walk, done: [...walk.done, record], agreed: { ...walk.agreed, tasks } };
    }
    if (op.kind === 'leversApplied') {
      const raise = op.raiseBudgetInr ?? 0;
      walk = {
        ...walk,
        leverIds: leversInDataOrder(context.data, [...walk.leverIds, ...op.leverIds]).filter(
          (id) => id !== RAISE_BUDGET_ID,
        ),
        budgetInr: walk.budgetInr + raise,
        raises:
          op.raiseBudgetInr === null
            ? walk.raises
            : [...walk.raises, { opIndex: index, amountInr: raise }],
      };
    }
    if (op.kind === 'changeConfirmed') {
      const next = applyChange(walk, op, index, context);
      if (!next.ok) return next;
      walk = next.value;
    }
  }
  return planOk(walk);
}
