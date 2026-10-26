// The two passes of architecture 4.6, in day numbers so the arithmetic is plain integers and the
// conversion back to dates happens once, at the edge.

import type { OrderedTasks } from './dependency-order';

export interface TaskTiming {
  readonly earliestStart: number;
  readonly earliestFinish: number;
  readonly latestStart: number;
  readonly latestFinish: number;
  /** Latest finish minus earliest finish: negative means the task cannot finish in time. */
  readonly slackDays: number;
  /** The undone predecessor whose finish set this task's start, or null when today or a delay did. */
  readonly binding: string | null;
}

export interface PassInput {
  readonly ordered: OrderedTasks;
  readonly eventDay: number;
  readonly today: number;
  /** The day each finished task was marked done. */
  readonly doneOn: ReadonlyMap<string, number>;
  /** The absolute day before which a delayed task cannot start (D11). */
  readonly notBefore: ReadonlyMap<string, number>;
}

/** Latest start and finish, walking from the event date back through the dependants. */
function backwardPass(input: PassInput): Map<string, { start: number; finish: number }> {
  const { ordered, eventDay, doneOn } = input;
  const successors = new Map<string, string[]>();
  for (const [id, dependencies] of ordered.dependencies) {
    for (const dependency of dependencies) {
      successors.set(dependency, [...(successors.get(dependency) ?? []), id]);
    }
  }
  const latest = new Map<string, { start: number; finish: number }>();
  for (const task of [...ordered.order].reverse()) {
    let finish = eventDay - task.latestFinishDaysBefore;
    for (const successor of successors.get(task.id) ?? []) {
      // A finished dependant no longer waits on anything, so it sets no deadline.
      if (doneOn.has(successor)) continue;
      const start = latest.get(successor)?.start;
      if (start !== undefined) finish = Math.min(finish, start);
    }
    latest.set(task.id, { start: finish - task.durationDays, finish });
  }
  return latest;
}

export function computeTimings(input: PassInput): ReadonlyMap<string, TaskTiming> {
  const { ordered, today, doneOn, notBefore } = input;
  const latest = backwardPass(input);
  const earliestFinish = new Map<string, number>();
  const timings = new Map<string, TaskTiming>();
  for (const task of ordered.order) {
    const bounds = latest.get(task.id) ?? { start: input.eventDay, finish: input.eventDay };
    const finishedOn = doneOn.get(task.id);
    let start: number;
    let finish: number;
    let binding: string | null = null;
    if (finishedOn === undefined) {
      // Done predecessors are left out: they are finished, so they push nobody.
      const floor = Math.max(today, notBefore.get(task.id) ?? today);
      start = floor;
      for (const dependency of ordered.dependencies.get(task.id) ?? []) {
        const predecessorFinish = earliestFinish.get(dependency);
        if (doneOn.has(dependency) || predecessorFinish === undefined) continue;
        // Strictly later wins; on a tie the earlier task in data order keeps the claim.
        if (predecessorFinish >= floor && (binding === null || predecessorFinish > start)) {
          start = predecessorFinish;
          binding = dependency;
        }
      }
      finish = start + task.durationDays;
    } else {
      start = finishedOn;
      finish = finishedOn;
    }
    earliestFinish.set(task.id, finish);
    timings.set(task.id, {
      earliestStart: start,
      earliestFinish: finish,
      latestStart: bounds.start,
      latestFinish: bounds.finish,
      slackDays: bounds.finish - finish,
      binding,
    });
  }
  return timings;
}
