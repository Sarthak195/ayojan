// The task scheduler (architecture 4.6, FR-12): a backward pass from the event date, a forward
// pass from today, slack, status and the critical path. A pure function of its input, so the
// same plan viewed on any later day, or on another server, shows the same schedule.

import type { IsoDate } from '@/core/calendar/day-number';
import { fromDayNumber, toDayNumber } from '@/core/calendar/day-number';

import { criticalPathOf } from './critical-path';
import { orderTasks } from './dependency-order';
import { computeTimings } from './schedule-passes';
import type { TaskTiming } from './schedule-passes';
import type {
  DelayRecord,
  DoneRecord,
  Schedule,
  ScheduleInput,
  ScheduleResult,
  ScheduledTask,
} from './schedule-types';
import { presentationOf, statusOf } from './status';
import { resolveTask } from './task-selection';
import type { ResolvedTask } from './task-selection';

/** Under this many days the plan is computed as usual and flagged, not refused. */
export const SHORT_NOTICE_DAYS = 14;

/** The latest `on` per task, so marking a task done twice keeps the later date (FR-14). */
export function latestDone(records: readonly DoneRecord[]): Map<string, DoneRecord> {
  const latest = new Map<string, DoneRecord>();
  for (const record of records) {
    const kept = latest.get(record.taskId);
    if (kept === undefined || toDayNumber(record.on) >= toDayNumber(kept.on)) {
      latest.set(record.taskId, record);
    }
  }
  return latest;
}

/** The latest `notBefore` per task: each is an absolute date, so delays never add up here. */
export function latestNotBefore(records: readonly DelayRecord[]): Map<string, IsoDate> {
  const latest = new Map<string, IsoDate>();
  for (const record of records) {
    const kept = latest.get(record.taskId);
    if (kept === undefined || toDayNumber(record.notBefore) > toDayNumber(kept)) {
      latest.set(record.taskId, record.notBefore);
    }
  }
  return latest;
}

function isoOf(day: number): IsoDate | null {
  const result = fromDayNumber(day);
  return result.ok ? result.value : null;
}

interface DescribeContext {
  readonly today: number;
  readonly input: ScheduleInput;
  readonly doneOn: ReadonlyMap<string, IsoDate>;
  readonly notBefore: ReadonlyMap<string, IsoDate>;
  readonly critical: ReadonlySet<string>;
  readonly dependencies: readonly string[];
}

function describe(
  task: ResolvedTask,
  timing: TaskTiming,
  context: DescribeContext,
): ScheduledTask | null {
  const earliestStart = isoOf(timing.earliestStart);
  const earliestFinish = isoOf(timing.earliestFinish);
  const latestStart = isoOf(timing.latestStart);
  const latestFinish = isoOf(timing.latestFinish);
  if (!earliestStart || !earliestFinish || !latestStart || !latestFinish) return null;
  const doneOn = context.doneOn.get(task.id) ?? null;
  const status = statusOf(
    {
      done: doneOn !== null,
      slackDays: timing.slackDays,
      daysToLatestFinish: timing.latestFinish - context.today,
      daysToLatestStart: timing.latestStart - context.today,
    },
    context.input.thresholds,
  );
  return {
    id: task.id,
    category: task.category,
    en: task.en,
    hi: task.hi,
    books: task.books,
    fasterApplied: task.fasterApplied,
    dependsOn: context.dependencies,
    durationDays: task.durationDays,
    earliestStart,
    earliestFinish,
    latestStart,
    latestFinish,
    slackDays: timing.slackDays,
    done: doneOn !== null,
    doneOn,
    notBefore: context.notBefore.get(task.id) ?? null,
    status,
    presentation: presentationOf(status),
    onCriticalPath: context.critical.has(task.id),
    bindingPredecessor: timing.binding,
  };
}

function toDays(dates: ReadonlyMap<string, IsoDate>): Map<string, number> {
  return new Map([...dates].map(([id, date]) => [id, toDayNumber(date)]));
}

export function buildSchedule(input: ScheduleInput): ScheduleResult {
  const faster = new Set(input.faster);
  const resolved = input.selection.active.map((row) => resolveTask(row, faster.has(row.id)));
  const ordered = orderTasks(resolved, input.selection.knownIds);
  if (!ordered.ok) return ordered;

  // Records that name a task outside the plan are ignored: the plan cannot show them anyway.
  const activeIds = new Set(resolved.map((task) => task.id));
  const doneOn = new Map(
    [...latestDone(input.done)]
      .filter(([id]) => activeIds.has(id))
      .map(([id, record]) => [id, record.on]),
  );
  const notBefore = new Map([...latestNotBefore(input.delays)].filter(([id]) => activeIds.has(id)));
  const today = toDayNumber(input.today);
  const eventDay = toDayNumber(input.eventDate);

  const timings = computeTimings({
    ordered: ordered.value,
    eventDay,
    today,
    doneOn: toDays(doneOn),
    notBefore: toDays(notBefore),
  });
  const criticalPath = criticalPathOf(resolved, timings, new Set(doneOn.keys()));
  const critical = new Set(criticalPath);

  const tasks: ScheduledTask[] = [];
  for (const task of ordered.value.order) {
    const timing = timings.get(task.id);
    const scheduled =
      timing === undefined
        ? null
        : describe(task, timing, {
            today,
            input,
            doneOn,
            notBefore,
            critical,
            dependencies: ordered.value.dependencies.get(task.id) ?? [],
          });
    if (scheduled === null) {
      return { ok: false, problem: { reason: 'date-out-of-range', taskIds: [task.id] } };
    }
    tasks.push(scheduled);
  }
  const daysToEvent = eventDay - today;
  const schedule: Schedule = {
    today: input.today,
    eventDate: input.eventDate,
    daysToEvent,
    shortNotice: daysToEvent < SHORT_NOTICE_DAYS,
    tasks,
    criticalPath,
  };
  return { ok: true, schedule };
}
