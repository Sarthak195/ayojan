// The one mutation path (architecture 4.8, FR-25, D10): every op joins a plan here or is refused
// here, so a crafted link and a form post meet the same rules. Checks are structural (does the
// task exist and is it active, is the change empty, does a lever clash with a must-have); the
// numbers each op leads to are derived later by plan-view, never stored.

import { parseIsoDate } from '@/core/calendar/day-number';
import { BUDGET_MAX_INR, BUDGET_MIN_INR } from '@/schemas/plan/brief';
import { MAX_OPS, type Op } from '@/schemas/plan/op';

import { profileForOccasion } from '../budget/budget-profile';
import { markDone, type MarkDoneRefusal } from '../timeline/task-progress';
import { resolveTask, selectTasks } from '../timeline/task-selection';
import { leversInDataOrder, type PlanData } from './plan-data';
import type { BriefOp, ChangeOp, LeversOp, PlanInputs } from './plan-inputs';
import { applyFail, budgetFail, planOk, type ApplyRefusal, type PlanResult } from './plan-refusal';

/** At most six quotes, one per slot A to F. */
export const MAX_QUOTES = 6;

const MAX_GUESTS = 5_000;

function startPlan(op: BriefOp, data: PlanData): PlanResult<PlanInputs> {
  if (!parseIsoDate(op.brief.eventDate).ok) return applyFail('date-invalid', 0);
  const profile = profileForOccasion(data.budgetWeights, op.brief.occasion);
  if (!profile.ok) return budgetFail(profile.reason);
  const selection = selectTasks(
    data.tasks.tasks,
    { functions: op.brief.functions, mustHaves: op.brief.mustHaves, needs: op.brief.needs },
    profile.value.id,
  );
  return planOk({
    ops: [op],
    brief: op.brief,
    profile: profile.value.id,
    selection,
    quotes: [],
    doneTaskIds: [],
    leverIds: [],
    latestChange: null,
  });
}

function checkTask(inputs: PlanInputs, taskId: string, index: number): PlanResult<null> {
  if (!inputs.selection.knownIds.has(taskId)) return applyFail('unknown-task', index);
  const active = inputs.selection.active.some((row) => row.id === taskId);
  return active ? planOk(null) : applyFail('inactive-task', index);
}

function checkChange(op: ChangeOp, index: number): PlanResult<null> {
  const nothing =
    op.guests === null &&
    op.budgetInr === null &&
    op.eventDate === null &&
    op.reallocate === null &&
    op.priorities === null;
  if (nothing) return applyFail('empty-change', index);
  // The op schema lets 0 through so a reading can carry what was said; a plan cannot hold it.
  if (op.budgetInr !== null && (op.budgetInr < BUDGET_MIN_INR || op.budgetInr > BUDGET_MAX_INR)) {
    return applyFail('budget-out-of-range', index);
  }
  if (op.guests !== null && op.guests > MAX_GUESTS) return applyFail('guests-out-of-range', index);
  if (op.eventDate !== null && !parseIsoDate(op.eventDate).ok) {
    return applyFail('date-invalid', index);
  }
  return planOk(null);
}

// Only the must-have clash can be judged from the op alone. Whether a refused lever had its
// "Show anyway" box ticked is the route's check, made against the plan as it then stood.
function checkLevers(
  inputs: PlanInputs,
  op: LeversOp,
  data: PlanData,
  index: number,
): PlanResult<null> {
  if (op.leverIds.length === 0) return applyFail('no-levers', index);
  for (const id of op.leverIds) {
    const row = data.levers.levers.find((lever) => lever.id === id);
    if (row === undefined) return applyFail('unknown-lever', index);
    if (row.mustHaveConflicts.some((item) => inputs.brief.mustHaves.includes(item))) {
      return applyFail('lever-disabled', index);
    }
  }
  // The raise is stored as the rupees the family agreed to, so the id and the amount go together.
  const raises = op.leverIds.includes('raise-budget');
  if (raises && op.raiseBudgetInr === null) return applyFail('raise-without-amount', index);
  if (!raises && op.raiseBudgetInr !== null) return applyFail('amount-without-raise', index);
  return planOk(null);
}

function doneRefusal(reason: MarkDoneRefusal): ApplyRefusal {
  switch (reason) {
    case 'unknown-task':
      return 'inactive-task';
    case 'amount-on-task-without-booking':
    case 'capacity-on-task-without-venue':
      return reason;
    case 'amount-not-whole-rupees':
    case 'capacity-not-positive-whole-number':
      return 'amount-invalid';
  }
}

function continuePlan(inputs: PlanInputs, op: Op, data: PlanData): PlanResult<PlanInputs> {
  const index = inputs.ops.length;
  const ops = [...inputs.ops, op];
  switch (op.kind) {
    case 'briefConfirmed':
      return applyFail('brief-already-confirmed', index);
    case 'quoteAdded':
      if (inputs.quotes.length >= MAX_QUOTES) return applyFail('quote-limit', index);
      if (inputs.quotes.some((quote) => quote.id === op.quote.id)) {
        return applyFail('quote-slot-taken', index);
      }
      return planOk({ ...inputs, ops, quotes: [...inputs.quotes, op.quote] });
    case 'taskDone': {
      const known = checkTask(inputs, op.taskId, index);
      if (!known.ok) return known;
      const on = parseIsoDate(op.on);
      if (!on.ok) return applyFail('date-invalid', index);
      const tasks = inputs.selection.active.map((row) => resolveTask(row, false));
      const record = { taskId: op.taskId, on: on.value, amountInr: op.amountInr };
      const marked = markDone({ ...record, capacity: op.capacity }, tasks);
      if (!marked.ok) return applyFail(doneRefusal(marked.reason), index);
      // Marking done twice is allowed: the later mark wins and both stay in the ledger (FR-14).
      const doneTaskIds = inputs.doneTaskIds.includes(op.taskId)
        ? inputs.doneTaskIds
        : [...inputs.doneTaskIds, op.taskId];
      return planOk({ ...inputs, ops, doneTaskIds });
    }
    case 'taskDelayed': {
      const known = checkTask(inputs, op.taskId, index);
      if (!known.ok) return known;
      if (inputs.doneTaskIds.includes(op.taskId)) return applyFail('task-already-done', index);
      if (!parseIsoDate(op.notBefore).ok) return applyFail('date-invalid', index);
      return planOk({ ...inputs, ops });
    }
    case 'changeConfirmed': {
      const checked = checkChange(op, index);
      return checked.ok ? planOk({ ...inputs, ops, latestChange: index }) : checked;
    }
    case 'leversApplied': {
      const checked = checkLevers(inputs, op, data, index);
      if (!checked.ok) return checked;
      return planOk({
        ...inputs,
        ops,
        leverIds: leversInDataOrder(data, [...inputs.leverIds, ...op.leverIds]),
      });
    }
  }
}

/**
 * Adds one op to a plan, or refuses it with the reason. `inputs` is null before the brief.
 * The input is never mutated, so the caller can keep the previous plan for Undo and preview.
 */
export function apply(inputs: PlanInputs | null, op: Op, data: PlanData): PlanResult<PlanInputs> {
  if (inputs === null) {
    return op.kind === 'briefConfirmed' ? startPlan(op, data) : applyFail('no-brief', 0);
  }
  // The 41st step is refused rather than merged into a baseline (D06, FR-37).
  if (inputs.ops.length >= MAX_OPS) return applyFail('op-cap', inputs.ops.length);
  return continuePlan(inputs, op, data);
}
