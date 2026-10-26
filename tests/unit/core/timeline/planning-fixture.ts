// Shared setup for the timeline tests: the real task data, the spec's dates and small builders.
// The scenario dates are the spec's (today 2026-10-31, wedding 2027-02-26); the data's day
// counts are read from the file, so a changed assumption moves the tests with it.

import { join } from 'node:path';

import type { IsoDate } from '@/core/calendar/day-number';
import { addDays, parseIsoDate } from '@/core/calendar/day-number';
import { buildSchedule } from '@/core/timeline/schedule';
import type { Schedule, ScheduleInput } from '@/core/timeline/schedule-types';
import { thresholdsFrom } from '@/core/timeline/status';
import type { TaskNeeds } from '@/core/timeline/task-selection';
import { selectTasks } from '@/core/timeline/task-selection';
import type { TaskRow, TasksFile } from '@/schemas/data/tasks';
import { createKnowledgeRepository, readFromDirectory } from '@/server/knowledge/repository';

export function iso(text: string): IsoDate {
  const parsed = parseIsoDate(text);
  if (!parsed.ok) throw new Error(`test fixture ${text} is not a valid date`);
  return parsed.value;
}

export const TODAY = iso('2026-10-31');
export const EVENT = iso('2027-02-26');

export const tasksFile: TasksFile = createKnowledgeRepository(
  readFromDirectory(join(process.cwd(), 'data')),
).get('tasks');

export const NOTHING_EXTRA: TaskNeeds = { functions: {}, mustHaves: [], needs: [] };

/** The persona's wedding: sangeet and mehndi, a dhol, and Nani's wheelchair. */
export const PERSONA: TaskNeeds = {
  functions: { sangeet: 'yes', mehndi: 'yes', haldi: 'no', wedding: 'yes', reception: 'unsure' },
  mustHaves: ['dhol'],
  needs: ['wheelchair'],
};

export function templateOf(id: string): TaskRow {
  const row = tasksFile.tasks.find((task) => task.id === id);
  if (row === undefined) throw new Error(`no task template ${id} in data/tasks.yaml`);
  return row;
}

export function inputFor(
  overrides: Partial<ScheduleInput> = {},
  needs: TaskNeeds = PERSONA,
): ScheduleInput {
  return {
    selection: selectTasks(tasksFile.tasks, needs, 'wedding'),
    eventDate: EVENT,
    today: TODAY,
    done: [],
    delays: [],
    faster: [],
    thresholds: thresholdsFrom(tasksFile),
    ...overrides,
  };
}

export function scheduleFor(
  overrides: Partial<ScheduleInput> = {},
  needs: TaskNeeds = PERSONA,
): Schedule {
  const result = buildSchedule(inputFor(overrides, needs));
  if (!result.ok) throw new Error(`fixture schedule refused: ${result.problem.reason}`);
  return result.schedule;
}

export function taskIn(schedule: Schedule, id: string) {
  const task = schedule.tasks.find((candidate) => candidate.id === id);
  if (task === undefined) throw new Error(`task ${id} is not in the schedule`);
  return task;
}

export function plus(date: IsoDate, days: number): IsoDate {
  const moved = addDays(date, days);
  if (!moved.ok) throw new Error(`cannot move ${date} by ${String(days)} days`);
  return moved.value;
}

/** The spec's change-test setup: the venue booked on day one, the decorator pushed to 10 Nov. */
export const VENUE_BOOKED = {
  taskId: 'book-venue',
  on: TODAY,
  amountInr: 180_000,
  capacity: 220,
} as const;
export const DECORATOR_DELAYED = {
  taskId: 'book-decorator',
  notBefore: iso('2026-11-10'),
} as const;
