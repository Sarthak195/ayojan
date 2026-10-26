// What a change does to the schedule, as a comparison of two schedules built from the same plan
// with one thing different. Reasons are plain data here; the revision diff owns the reason codes
// the page prints.

import type { IsoDate } from '@/core/calendar/day-number';
import { daysBetween } from '@/core/calendar/day-number';

import { buildSchedule } from './schedule';
import type { DelayRecord, Schedule, ScheduleInput, ScheduleProblem } from './schedule-types';
import type { TaskStatus } from './status';

/** A task that now starts later because a task it waits on was delayed. */
export interface DelayedDependant {
  readonly taskId: string;
  readonly movedDays: number;
  readonly becauseOf: string;
  readonly slackDays: number;
  readonly status: TaskStatus;
}

export interface DelayPropagation {
  readonly delayedTaskId: string;
  /** How far the delayed task's own start moved; zero when its start was already later than the delay. */
  readonly movedDays: number;
  /** Only the dependants whose start rose, in dependency order. */
  readonly dependants: readonly DelayedDependant[];
}

export interface StatusShift {
  readonly taskId: string;
  readonly from: TaskStatus;
  readonly to: TaskStatus;
  readonly slackBefore: number;
  readonly slackAfter: number;
}

function startOf(schedule: Schedule, taskId: string): IsoDate | null {
  return schedule.tasks.find((task) => task.id === taskId)?.earliestStart ?? null;
}

/** Every task that waits, directly or through others, on the given one. */
function dependantsOf(schedule: Schedule, taskId: string): Set<string> {
  const found = new Set<string>([taskId]);
  // The list is in dependency order, so one pass sees each task after everything it waits on.
  for (const task of schedule.tasks) {
    if (task.dependsOn.some((id) => found.has(id))) found.add(task.id);
  }
  found.delete(taskId);
  return found;
}

export function delayPropagation(
  before: Schedule,
  after: Schedule,
  delayedTaskId: string,
): DelayPropagation {
  const downstream = dependantsOf(after, delayedTaskId);
  const dependants: DelayedDependant[] = [];
  for (const task of after.tasks) {
    const earlier = startOf(before, task.id);
    if (!downstream.has(task.id) || earlier === null) continue;
    const movedDays = daysBetween(earlier, task.earliestStart);
    if (movedDays > 0) {
      dependants.push({
        taskId: task.id,
        movedDays,
        becauseOf: delayedTaskId,
        slackDays: task.slackDays,
        status: task.status,
      });
    }
  }
  const own = { from: startOf(before, delayedTaskId), to: startOf(after, delayedTaskId) };
  const movedDays = own.from === null || own.to === null ? 0 : daysBetween(own.from, own.to);
  return { delayedTaskId, movedDays: Math.max(0, movedDays), dependants };
}

/** Tasks that were not Late or At risk and now are, for example after the event date moves earlier. */
export function worsenedStatuses(before: Schedule, after: Schedule): StatusShift[] {
  const shifts: StatusShift[] = [];
  for (const task of after.tasks) {
    const earlier = before.tasks.find((candidate) => candidate.id === task.id);
    if (earlier === undefined || earlier.status === task.status) continue;
    if (task.status === 'late' || task.status === 'atRisk') {
      shifts.push({
        taskId: task.id,
        from: earlier.status,
        to: task.status,
        slackBefore: earlier.slackDays,
        slackAfter: task.slackDays,
      });
    }
  }
  return shifts;
}

export type DelayEffect =
  | { readonly ok: true; readonly schedule: Schedule; readonly propagation: DelayPropagation }
  | { readonly ok: false; readonly problem: ScheduleProblem };

/** The plan as it would be after recording the delay, and what the delay moved. */
export function delayEffect(input: ScheduleInput, delay: DelayRecord): DelayEffect {
  const before = buildSchedule(input);
  if (!before.ok) return before;
  const after = buildSchedule({ ...input, delays: [...input.delays, delay] });
  if (!after.ok) return after;
  return {
    ok: true,
    schedule: after.schedule,
    propagation: delayPropagation(before.schedule, after.schedule, delay.taskId),
  };
}

export type EventDateEffect =
  | { readonly ok: true; readonly schedule: Schedule; readonly shifts: readonly StatusShift[] }
  | { readonly ok: false; readonly problem: ScheduleProblem };

/**
 * The plan with the event on another date. Earliest starts stay anchored to today, so moving the
 * date earlier by k days cuts every event-anchored task's slack by k and the shifts list the
 * tasks that cross into At risk or Late.
 */
export function eventDateEffect(input: ScheduleInput, eventDate: IsoDate): EventDateEffect {
  const before = buildSchedule(input);
  if (!before.ok) return before;
  const after = buildSchedule({ ...input, eventDate });
  if (!after.ok) return after;
  return {
    ok: true,
    schedule: after.schedule,
    shifts: worsenedStatuses(before.schedule, after.schedule),
  };
}
