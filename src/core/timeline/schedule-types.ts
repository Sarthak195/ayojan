// The shapes the scheduler takes and returns, kept apart from the arithmetic so the change
// reports and the plan view can import them without importing the passes.

import type { IsoDate } from '@/core/calendar/day-number';
import type { Category } from '@/schemas/readings/vocabulary';

import type { GraphProblem } from './dependency-order';
import type { StatusPresentation, StatusThresholds, TaskStatus } from './status';
import type { TaskSelection } from './task-selection';

/** A finished task, as the `taskDone` op stores it. */
export interface DoneRecord {
  readonly taskId: string;
  readonly on: IsoDate;
  readonly amountInr: number | null;
  readonly capacity: number | null;
}

/** A slipping task, as the `taskDelayed` op stores it: an absolute date, never a count (D11). */
export interface DelayRecord {
  readonly taskId: string;
  readonly notBefore: IsoDate;
}

export interface ScheduleInput {
  readonly selection: TaskSelection;
  readonly eventDate: IsoDate;
  /** Always a parameter: the core never reads the clock. */
  readonly today: IsoDate;
  readonly done: readonly DoneRecord[];
  readonly delays: readonly DelayRecord[];
  /** Task ids switched to their faster alternative by a lever. */
  readonly faster: readonly string[];
  readonly thresholds: StatusThresholds;
}

export interface ScheduledTask {
  readonly id: string;
  readonly category: Category;
  readonly en: string;
  readonly hi: string;
  readonly books: Category | null;
  readonly fasterApplied: boolean;
  /** Active dependencies only. */
  readonly dependsOn: readonly string[];
  readonly durationDays: number;
  readonly earliestStart: IsoDate;
  readonly earliestFinish: IsoDate;
  readonly latestStart: IsoDate;
  readonly latestFinish: IsoDate;
  readonly slackDays: number;
  readonly done: boolean;
  readonly doneOn: IsoDate | null;
  /** The latest delay recorded for the task, if any. */
  readonly notBefore: IsoDate | null;
  readonly status: TaskStatus;
  readonly presentation: StatusPresentation;
  readonly onCriticalPath: boolean;
  /** The predecessor whose finish sets this task's start, or null. */
  readonly bindingPredecessor: string | null;
}

export interface Schedule {
  readonly today: IsoDate;
  readonly eventDate: IsoDate;
  /** Zero or negative once the event is today or past. */
  readonly daysToEvent: number;
  /** True under 14 days, so the page can say most tasks are already late. */
  readonly shortNotice: boolean;
  /** In dependency order, ties by data order. */
  readonly tasks: readonly ScheduledTask[];
  /** First to last, ending at the unfinished task with the least slack. */
  readonly criticalPath: readonly string[];
}

export type ScheduleProblem =
  GraphProblem | { readonly reason: 'date-out-of-range'; readonly taskIds: readonly string[] };

export type ScheduleResult =
  | { readonly ok: true; readonly schedule: Schedule }
  | { readonly ok: false; readonly problem: ScheduleProblem };
