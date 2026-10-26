// Why a row of the revision diff changed. Each row names one cause, picked in a fixed order
// from what differs between the two versions, so the same pair always gives the same reason and
// the page can say "because the guests changed" without guessing.

import type { QuoteSlot } from '@/schemas/plan/quote-record';
import type { Category } from '@/schemas/readings/vocabulary';

import type { ScheduledTask } from '../timeline/schedule-types';
import type { PlanData } from './plan-data';
import type { PlanVersion } from './plan-version';

/**
 * The closed set of FR-25, plus `task-done` and `quote-added` for comparing versions further
 * apart than one change (an internal comparison, D32); the revision pair never needs them.
 */
export type ReasonCode =
  | 'guests-changed'
  | 'budget-changed'
  | 'event-date-moved'
  | 'reallocated'
  | 'ranking-flipped'
  | `task-delayed:${string}`
  | `lever-applied:${string}`
  | `task-done:${string}`
  | `quote-added:${QuoteSlot}`;

function leversOn(version: PlanVersion, category: Category): string[] {
  return version.money.applied
    .filter((lever) => lever.category === category)
    .map((lever) => lever.id);
}

function bookingKey(version: PlanVersion, category: Category): string {
  const booking = version.bookings.find((candidate) => candidate.category === category);
  return booking === undefined ? '' : JSON.stringify(booking);
}

function slotsFor(version: PlanVersion, category: Category): QuoteSlot[] {
  return version.quotes.filter((quote) => quote.category === category).map((quote) => quote.id);
}

/** The cause of a money line changing: levers, then a booking, a move, a quote, the guests. */
export function moneyReason(
  before: PlanVersion,
  after: PlanVersion,
  category: Category,
): ReasonCode {
  const leversBefore = leversOn(before, category);
  const newLever = leversOn(after, category).find((id) => !leversBefore.includes(id));
  const goneLever = leversBefore.find((id) => !leversOn(after, category).includes(id));
  const lever = newLever ?? goneLever;
  if (lever !== undefined) return `lever-applied:${lever}`;
  if (bookingKey(before, category) !== bookingKey(after, category)) {
    const booking =
      after.bookings.find((candidate) => candidate.category === category) ??
      before.bookings.find((candidate) => candidate.category === category);
    if (booking !== undefined) return `task-done:${booking.taskId}`;
  }
  const deltaBefore = before.money.input.deltas[category] ?? 0;
  if (deltaBefore !== (after.money.input.deltas[category] ?? 0)) return 'reallocated';
  const slotsBefore = slotsFor(before, category);
  const slotsAfter = slotsFor(after, category);
  const slot =
    slotsAfter.find((id) => !slotsBefore.includes(id)) ??
    slotsBefore.find((id) => !slotsAfter.includes(id));
  if (slot !== undefined) return `quote-added:${slot}`;
  // Nothing else moves a line: what is left is the per-guest scaling of a new guest count.
  return 'guests-changed';
}

/** Every task the given one waits on, directly or through others, plus itself. */
function upstreamOf(tasks: readonly ScheduledTask[], taskId: string): Set<string> {
  const found = new Set<string>([taskId]);
  // In reverse dependency order each task is seen before everything it waits on.
  for (const task of [...tasks].reverse()) {
    if (found.has(task.id)) for (const id of task.dependsOn) found.add(id);
  }
  return found;
}

function taskIn(version: PlanVersion, taskId: string): ScheduledTask | undefined {
  return version.schedule.tasks.find((task) => task.id === taskId);
}

/** The cause of a task's dates or status changing. */
export function taskReason(
  before: PlanVersion,
  after: PlanVersion,
  taskId: string,
  data: PlanData,
): ReasonCode {
  const own = { before: taskIn(before, taskId), after: taskIn(after, taskId) };
  if (own.before?.fasterApplied !== own.after?.fasterApplied) {
    const lever = data.levers.levers.find(
      (row) => row.effect === 'percentOfCategory' && row.fasterAlternativeFor === taskId,
    );
    if (lever !== undefined) return `lever-applied:${lever.id}`;
  }
  const upstream = upstreamOf(after.schedule.tasks, taskId);
  for (const task of after.schedule.tasks) {
    if (!upstream.has(task.id)) continue;
    if (taskIn(before, task.id)?.notBefore !== task.notBefore) return `task-delayed:${task.id}`;
  }
  for (const task of after.schedule.tasks) {
    if (!upstream.has(task.id)) continue;
    if (taskIn(before, task.id)?.doneOn !== task.doneOn) return `task-done:${task.id}`;
  }
  // Earliest starts are anchored to today, so the only other input is the event date.
  return 'event-date-moved';
}

export function raisedInr(version: PlanVersion): number {
  return version.money.applied.find((lever) => lever.category === null)?.effect.inr ?? 0;
}
