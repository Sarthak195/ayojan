// Marking a task done and delaying it (FR-14, D10, D11). These build the records the `taskDone`
// and `taskDelayed` ops store; the plan layer wraps them in ops and the budget engine reads the
// bookings, so a booking has exactly one path from the task list to the money table.

import { addDays, parseIsoDate } from '@/core/calendar/day-number';
import { MAX_DELAY_DAYS } from '@/schemas/forms/task-event';
import type { Op } from '@/schemas/plan/op';
import type { Category } from '@/schemas/readings/vocabulary';

import { latestDone } from './schedule';
import type { DelayRecord, DoneRecord, Schedule } from './schedule-types';
import type { ResolvedTask } from './task-selection';

// The form owns the 1 to 60 day range (D11); the core enforces the same bound so a crafted
// request that skipped the form fails here too.
export { MAX_DELAY_DAYS };
export const MIN_DELAY_DAYS = 1;

/** What a booking task being marked done with an amount tells the budget engine. */
export interface Booking {
  readonly taskId: string;
  readonly category: Category;
  readonly amountInr: number;
  /** Replaces the brief's venue capacity; only a venue booking carries one. */
  readonly capacity: number | null;
}

export type MarkDoneRefusal =
  | 'unknown-task'
  | 'amount-not-whole-rupees'
  | 'amount-on-task-without-booking'
  | 'capacity-not-positive-whole-number'
  | 'capacity-on-task-without-venue';

export type MarkDoneResult =
  | { readonly ok: true; readonly record: DoneRecord; readonly booking: Booking | null }
  | { readonly ok: false; readonly reason: MarkDoneRefusal };

export type DelayRefusal =
  'unknown-task' | 'already-done' | 'days-out-of-range' | 'date-out-of-range';

export type DelayResult =
  | { readonly ok: true; readonly record: DelayRecord }
  | { readonly ok: false; readonly reason: DelayRefusal };

function refuseDone(reason: MarkDoneRefusal): MarkDoneResult {
  return { ok: false, reason };
}

function booking(task: ResolvedTask, request: DoneRecord): Booking | null {
  if (request.amountInr === null || task.books === null) return null;
  return {
    taskId: task.id,
    category: task.books,
    amountInr: request.amountInr,
    capacity: request.capacity,
  };
}

/**
 * Marks a task done. An amount books the task's category at that amount and nothing more: the
 * category's provenance and the capacity override are the budget engine's to apply (D10). Without
 * an amount the task is simply done and the category stays projected; a capacity given alone
 * stays on the record for the plan to apply, but is not a booking.
 */
export function markDone(request: DoneRecord, tasks: readonly ResolvedTask[]): MarkDoneResult {
  const task = tasks.find((candidate) => candidate.id === request.taskId);
  if (task === undefined) return refuseDone('unknown-task');
  const { amountInr, capacity } = request;
  // A booked amount of 0 is a number the family typed, not "unset", so only negatives and fractions fail.
  if (amountInr !== null && (!Number.isSafeInteger(amountInr) || amountInr < 0)) {
    return refuseDone('amount-not-whole-rupees');
  }
  if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1)) {
    return refuseDone('capacity-not-positive-whole-number');
  }
  if (amountInr !== null && task.books === null)
    return refuseDone('amount-on-task-without-booking');
  if (capacity !== null && task.books !== 'venue')
    return refuseDone('capacity-on-task-without-venue');
  return { ok: true, record: request, booking: booking(task, request) };
}

/**
 * Delays an unfinished task by N days from where the schedule now starts it, stored as an
 * absolute date (D11). Counting from the current start rather than from today means a second
 * delay adds to the first, and a task already waiting on a predecessor moves by the full N.
 */
export function delayTask(schedule: Schedule, taskId: string, days: number): DelayResult {
  const task = schedule.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) return { ok: false, reason: 'unknown-task' };
  if (task.done) return { ok: false, reason: 'already-done' };
  if (!Number.isInteger(days) || days < MIN_DELAY_DAYS || days > MAX_DELAY_DAYS) {
    return { ok: false, reason: 'days-out-of-range' };
  }
  const notBefore = addDays(task.earliestStart, days);
  if (!notBefore.ok) return { ok: false, reason: 'date-out-of-range' };
  return { ok: true, record: { taskId, notBefore: notBefore.value } };
}

/** Every booking the finished tasks report, in data order; a task marked done twice counts once, as its later mark. */
export function bookingsFrom(
  done: readonly DoneRecord[],
  tasks: readonly ResolvedTask[],
): Booking[] {
  const latest = latestDone(done);
  const bookings: Booking[] = [];
  for (const task of tasks) {
    const record = latest.get(task.id);
    const found = record === undefined ? null : booking(task, record);
    if (found !== null) bookings.push(found);
  }
  return bookings;
}

/** Reads the progress records out of a plan's ops, in ledger order. */
export function progressFromOps(ops: readonly Op[]): {
  readonly done: DoneRecord[];
  readonly delays: DelayRecord[];
} {
  const done: DoneRecord[] = [];
  const delays: DelayRecord[] = [];
  for (const op of ops) {
    // The token's schema already checked these as dates; parsing again gives the branded type.
    if (op.kind === 'taskDone') {
      const on = parseIsoDate(op.on);
      if (on.ok) {
        done.push({
          taskId: op.taskId,
          on: on.value,
          amountInr: op.amountInr,
          capacity: op.capacity,
        });
      }
    } else if (op.kind === 'taskDelayed') {
      const notBefore = parseIsoDate(op.notBefore);
      if (notBefore.ok) delays.push({ taskId: op.taskId, notBefore: notBefore.value });
    }
  }
  return { done, delays };
}
