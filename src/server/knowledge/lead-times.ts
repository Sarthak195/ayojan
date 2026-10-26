import 'server-only';

import type { TaskRow, TasksFile } from '@/schemas/data/tasks';

import { rowLabel, type DataProblem } from './data-problem';

// The small-celebration day counts (D40) that a schema cannot check on its own. A task the
// celebration profile keeps must carry them, or a birthday would silently fall back to a
// wedding's months of lead time; and a small gathering never needs longer than a wedding, so a
// larger number is a typo, not a planning choice.

type Timing = Pick<TaskRow, 'latestFinishDaysBefore' | 'durationDays'>;

function longerThan(small: Timing, wedding: Timing): string[] {
  const fields = ['latestFinishDaysBefore', 'durationDays'] as const;
  return fields.filter((field) => small[field] > wedding[field]);
}

function rowProblems(task: TaskRow): string[] {
  if (task.weddingOnly) {
    return task.celebration === null ? [] : ['A wedding-only task must have celebration: null.'];
  }
  if (task.celebration === null) {
    return ['celebration is missing: the small-celebration profile keeps this task.'];
  }
  const messages = longerThan(task.celebration, task).map(
    (field) => `celebration.${field} is longer than the wedding's ${field}.`,
  );
  const faster = task.fasterAlternative;
  if (faster !== null && faster.celebration === null) {
    messages.push('fasterAlternative.celebration is missing while the task has celebration.');
  }
  if (faster?.celebration) {
    for (const field of longerThan(faster.celebration, faster)) {
      messages.push(`fasterAlternative.celebration.${field} is longer than the wedding's.`);
    }
  }
  return messages;
}

export function leadTimeProblems(file: TasksFile): DataProblem[] {
  return file.tasks.flatMap((task, index) =>
    rowProblems(task).map((message) => ({
      fileName: 'tasks.yaml',
      row: rowLabel(['tasks', index], task),
      message,
    })),
  );
}
