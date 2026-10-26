// A stable topological order over the active tasks (architecture 4.6). Ties go to data order, so
// the same input always gives the same list and a page never reshuffles between views.

import type { ResolvedTask } from './task-selection';

export type GraphReason =
  'duplicate-task' | 'duplicate-dependency' | 'unknown-dependency' | 'cycle';

export interface GraphProblem {
  readonly reason: GraphReason;
  /** The tasks to blame: the duplicate, the task and its dependency, or the cycle in order. */
  readonly taskIds: readonly string[];
}

export interface OrderedTasks {
  readonly order: readonly ResolvedTask[];
  /** Active dependencies only, in data order: a dropped template counts as satisfied. */
  readonly dependencies: ReadonlyMap<string, readonly string[]>;
}

export type OrderResult =
  | { readonly ok: true; readonly value: OrderedTasks }
  | { readonly ok: false; readonly problem: GraphProblem };

function refuse(reason: GraphReason, taskIds: readonly string[]): OrderResult {
  return { ok: false, problem: { reason, taskIds } };
}

/** Walks unplaced dependencies until a task repeats; what remains of the walk is the cycle. */
function cycleAmong(
  tasks: readonly ResolvedTask[],
  placed: ReadonlySet<string>,
  dependencies: ReadonlyMap<string, readonly string[]>,
): string[] {
  const walked: string[] = [];
  const at = new Map<string, number>();
  let current = tasks.find((task) => !placed.has(task.id))?.id;
  while (current !== undefined && !at.has(current)) {
    at.set(current, walked.length);
    walked.push(current);
    // Every task Kahn could not place waits on at least one other unplaced task.
    current = (dependencies.get(current) ?? []).find((id) => !placed.has(id));
  }
  return current === undefined ? walked : walked.slice(at.get(current));
}

export function orderTasks(
  tasks: readonly ResolvedTask[],
  knownIds: ReadonlySet<string>,
): OrderResult {
  const position = new Map<string, number>();
  for (const [index, task] of tasks.entries()) {
    if (position.has(task.id)) return refuse('duplicate-task', [task.id]);
    position.set(task.id, index);
  }
  const at = (id: string): number => position.get(id) ?? 0;

  const dependencies = new Map<string, readonly string[]>();
  for (const task of tasks) {
    const seen = new Set<string>();
    const active: string[] = [];
    for (const dependency of task.dependsOn) {
      if (seen.has(dependency)) return refuse('duplicate-dependency', [task.id, dependency]);
      seen.add(dependency);
      if (dependency === task.id) return refuse('cycle', [task.id]);
      if (position.has(dependency)) active.push(dependency);
      else if (!knownIds.has(dependency))
        return refuse('unknown-dependency', [task.id, dependency]);
    }
    dependencies.set(
      task.id,
      active.sort((a, b) => at(a) - at(b)),
    );
  }

  const waitingOn = new Map<string, number>();
  const dependants = new Map<string, string[]>();
  for (const task of tasks) {
    const own = dependencies.get(task.id) ?? [];
    waitingOn.set(task.id, own.length);
    for (const dependency of own)
      dependants.set(dependency, [...(dependants.get(dependency) ?? []), task.id]);
  }

  const ready = tasks.filter((task) => waitingOn.get(task.id) === 0).map((task) => task.id);
  const placed = new Set<string>();
  const order: ResolvedTask[] = [];
  for (let id = ready.shift(); id !== undefined; id = ready.shift()) {
    const task = tasks[at(id)];
    if (task === undefined) break;
    placed.add(id);
    order.push(task);
    for (const next of dependants.get(id) ?? []) {
      const left = (waitingOn.get(next) ?? 0) - 1;
      waitingOn.set(next, left);
      if (left === 0) ready.push(next);
    }
    // Sorting the small ready list by data position is what makes ties stable.
    ready.sort((a, b) => at(a) - at(b));
  }

  if (order.length < tasks.length) return refuse('cycle', cycleAmong(tasks, placed, dependencies));
  return { ok: true, value: { order, dependencies } };
}
