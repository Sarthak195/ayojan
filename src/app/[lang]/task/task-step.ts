import 'server-only';

import { addDays } from '@/core/calendar/day-number';
import { previewOp } from '@/core/plan/plan-view';
import { TaskEvent } from '@/schemas/forms/task-event';
import { TaskId } from '@/schemas/generated/ids';
import type { Op } from '@/schemas/plan/op';
import type { StepOutcome, StepSpec } from '@/server/http/post-step';
import { appendOp } from '@/server/state/history';

// A well-formed request that names no task the plan can act on (unknown, inactive, already
// done for a delay, an amount on a task that books nothing) is a 422 (arch 6.3).
const CANNOT_APPLY: StepOutcome = { kind: 'problem', problem: 'cannot-apply', status: 422 };

/**
 * POST /[lang]/task: Mark done (the one booking path, D10) or Delayed by N days, stored as the
 * absolute date today plus N (D11) so a link opened next week shows the same schedule.
 */
export const taskStep: StepSpec<typeof TaskEvent> = {
  route: '/[lang]/task',
  rateClass: 'step',
  schema: TaskEvent,
  work: (form, context) => {
    const { lang } = context;
    const opened = context.open(form.token);
    if (!opened.ok) return { kind: 'problem', problem: 'damaged-link' };
    const { state, data, today } = opened.plan;
    const taskId = TaskId.safeParse(form.taskId);
    // A plan still waiting on its first brief has no tasks to mark.
    if (!taskId.success || state.ops.length === 0) return CANNOT_APPLY;
    let op: Op;
    if (form.event === 'done') {
      op = {
        kind: 'taskDone',
        taskId: taskId.data,
        on: today,
        amountInr: form.amountInr ?? null,
        capacity: form.capacity ?? null,
      };
    } else {
      const notBefore = addDays(today, form.days);
      if (!notBefore.ok) return CANNOT_APPLY;
      op = { kind: 'taskDelayed', taskId: taskId.data, notBefore: notBefore.value };
    }
    // The same fold every page runs decides whether the op joins the plan.
    if (!previewOp(state.ops, op, data, today).ok) return CANNOT_APPLY;
    const next = appendOp(state, op);
    if (!next.ok) return { kind: 'problem', problem: 'op-cap', status: 422 };
    return {
      kind: 'next',
      state: next.state,
      to: (token) => ({ to: 'plan', lang, token, anchor: 'tasks' }),
    };
  },
};
