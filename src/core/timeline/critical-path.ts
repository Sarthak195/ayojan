// The critical path (architecture 4.6): start at the unfinished task with the least slack and
// follow the predecessors that set each start, back to a task that waits on nothing.

import type { ResolvedTask } from './task-selection';
import type { TaskTiming } from './schedule-passes';

export function criticalPathOf(
  tasks: readonly ResolvedTask[],
  timings: ReadonlyMap<string, TaskTiming>,
  finished: ReadonlySet<string>,
): string[] {
  let tightest: { id: string; slackDays: number } | null = null;
  for (const task of tasks) {
    const slackDays = timings.get(task.id)?.slackDays;
    if (finished.has(task.id) || slackDays === undefined) continue;
    // Strictly less, so a tie goes to the task earlier in data order.
    if (tightest === null || slackDays < tightest.slackDays) tightest = { id: task.id, slackDays };
  }
  const path: string[] = [];
  let current: string | null = tightest?.id ?? null;
  while (current !== null) {
    path.unshift(current);
    current = timings.get(current)?.binding ?? null;
  }
  return path;
}
