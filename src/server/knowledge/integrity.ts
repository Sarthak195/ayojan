import 'server-only';

import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';
import type { FunctionsFile } from '@/schemas/data/functions';
import type { LeversFile } from '@/schemas/data/levers';
import type { TasksFile } from '@/schemas/data/tasks';
import type { VendorQuestionsFile } from '@/schemas/data/vendor-questions';
import { Category, FunctionName, Occasion, Priority } from '@/schemas/readings/vocabulary';

import { rowLabel, type DataProblem } from './data-problem';

// Checks within one file that a schema cannot express: uniqueness, references between rows,
// cycles and one row per closed-enum value. Each problem names its file and row.

type Rows = readonly unknown[];

function duplicates(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function exactlyOnce(
  fileName: string,
  listPath: string,
  values: readonly string[],
  expected: readonly string[],
): DataProblem[] {
  const missing = expected.filter((value) => !values.includes(value));
  const repeated = [...new Set(duplicates(values))];
  return [
    ...missing.map((value) => ({ fileName, row: listPath, message: `"${value}" is missing.` })),
    ...repeated.map((value) => ({ fileName, row: listPath, message: `"${value}" appears twice.` })),
  ];
}

function uniqueIds(
  fileName: string,
  list: string,
  rows: Rows,
  ids: readonly string[],
): DataProblem[] {
  return ids.flatMap((id, index) =>
    ids.indexOf(id) === index
      ? []
      : [
          {
            fileName,
            row: rowLabel([list, index], rows[index]),
            message: `Id "${id}" is used twice.`,
          },
        ],
  );
}

export function budgetWeightProblems(file: BudgetWeightsFile): DataProblem[] {
  const fileName = 'budget-weights.yaml';
  const problems = exactlyOnce(
    fileName,
    'multipliers',
    file.multipliers.map((row) => row.priority),
    Priority.options,
  );
  problems.push(
    ...exactlyOnce(
      fileName,
      'profiles',
      file.profiles.map((row) => row.id),
      ['wedding', 'celebration'],
    ),
    // One profile per occasion, so the profile a brief uses is never ambiguous (D38).
    ...exactlyOnce(
      fileName,
      'profiles.occasions',
      file.profiles.flatMap((row) => row.occasions),
      Occasion.options,
    ),
  );
  file.profiles.forEach((profile, p) => {
    const list = `profiles[${String(p)}] (${profile.id}).categories`;
    problems.push(
      ...exactlyOnce(
        fileName,
        list,
        profile.categories.map((row) => row.category),
        Category.options,
      ),
    );
    profile.categories.forEach((row, c) => {
      // Contingency's floor is a share of the whole budget; every other floor is a share of the
      // category's own allocation, which is what Move money protects.
      const expected = row.category === 'contingency' ? 'budget' : 'allocation';
      if (row.floor.of !== expected) {
        const where = rowLabel(['profiles', p, 'categories', c], row);
        problems.push({ fileName, row: where, message: `floor.of must be "${expected}".` });
      }
    });
  });
  return problems;
}

// Peels off tasks that can be ordered (nothing they wait on is left), then tasks nothing left
// waits on; what survives both passes lies on a cycle, so dependants of a cycle are not blamed.
function cycleMembers(file: TasksFile): string[] {
  const known = new Set(file.tasks.map((task) => task.id));
  const waits = new Map(
    file.tasks.map((task) => [task.id, new Set(task.dependsOn.filter((id) => known.has(id)))]),
  );
  const peel = (removable: (id: string) => boolean): void => {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const id of [...waits.keys()]) {
        if (!removable(id)) continue;
        waits.delete(id);
        for (const other of waits.values()) other.delete(id);
        progressed = true;
      }
    }
  };
  peel((id) => waits.get(id)?.size === 0);
  peel((id) => ![...waits.values()].some((other) => other.has(id)));
  return [...waits.keys()];
}

export function taskProblems(file: TasksFile): DataProblem[] {
  const fileName = 'tasks.yaml';
  const ids = file.tasks.map((task) => task.id);
  const problems = uniqueIds(fileName, 'tasks', file.tasks, ids);
  file.tasks.forEach((task, index) => {
    const row = rowLabel(['tasks', index], task);
    for (const dependency of new Set(duplicates(task.dependsOn))) {
      problems.push({ fileName, row, message: `dependsOn names "${dependency}" twice.` });
    }
    for (const dependency of task.dependsOn) {
      if (dependency === task.id)
        problems.push({ fileName, row, message: 'The task depends on itself.' });
      else if (!ids.includes(dependency)) {
        problems.push({
          fileName,
          row,
          message: `dependsOn names "${dependency}", which is not a task id.`,
        });
      }
    }
    if (task.books !== null && task.books !== task.category) {
      problems.push({
        fileName,
        row,
        message: `books "${task.books}" differs from category "${task.category}".`,
      });
    }
  });
  const cycle = cycleMembers(file);
  if (
    cycle.length > 0 &&
    !problems.some((problem) => problem.message.includes('depends on itself'))
  ) {
    const first = file.tasks.findIndex((task) => task.id === cycle[0]);
    problems.push({
      fileName,
      row: rowLabel(['tasks', first], file.tasks[first]),
      message: `Dependency cycle among: ${cycle.join(', ')}.`,
    });
  }
  return problems;
}

export function leverProblems(file: LeversFile): DataProblem[] {
  return uniqueIds(
    'levers.yaml',
    'levers',
    file.levers,
    file.levers.map((lever) => lever.id),
  );
}

export function questionProblems(file: VendorQuestionsFile): DataProblem[] {
  const fileName = 'vendor-questions.yaml';
  const problems = uniqueIds(
    fileName,
    'questions',
    file.questions,
    file.questions.map((row) => row.id),
  );
  file.questions.forEach((question, index) => {
    for (const category of new Set(duplicates(question.categories))) {
      const row = rowLabel(['questions', index], question);
      problems.push({ fileName, row, message: `categories names "${category}" twice.` });
    }
  });
  return problems;
}

export function functionProblems(file: FunctionsFile): DataProblem[] {
  return exactlyOnce(
    'functions.yaml',
    'functions',
    file.functions.map((row) => row.id),
    FunctionName.options,
  );
}
