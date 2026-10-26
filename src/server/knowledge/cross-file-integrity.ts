import 'server-only';

import type { DataDocuments } from '@/schemas/data/data-files';
import { Diet, MustHave, VenueLimit } from '@/schemas/readings/vocabulary';

import { rowLabel, type DataProblem } from './data-problem';

// Checks that span files: references from one file into another, and coverage of the closed
// enums the engines look up, so a must-have or a diet never silently maps to nothing.

export function crossFileProblems(documents: DataDocuments): DataProblem[] {
  const { tasks, levers, vendorQuestions, functions } = documents;
  const problems: DataProblem[] = [];

  functions.functions.forEach((row, index) => {
    const activated = tasks.tasks
      .filter((task) =>
        task.activatedBy.some((when) => when.when === 'function' && when.function === row.id),
      )
      .map((task) => task.id);
    const listed = [...row.tasks].sort().join(', ');
    if (listed !== [...activated].sort().join(', ')) {
      problems.push({
        fileName: 'functions.yaml',
        row: rowLabel(['functions', index], row),
        message: `tasks [${listed}] must equal the tasks activated by "${row.id}" in tasks.yaml [${activated.join(', ')}].`,
      });
    }
  });

  levers.levers.forEach((lever, index) => {
    if (lever.effect !== 'percentOfCategory' || lever.fasterAlternativeFor === null) return;
    const task = tasks.tasks.find((candidate) => candidate.id === lever.fasterAlternativeFor);
    if (task === undefined || task.fasterAlternative === null) {
      problems.push({
        fileName: 'levers.yaml',
        row: rowLabel(['levers', index], lever),
        message: `fasterAlternativeFor "${lever.fasterAlternativeFor}" is not a task with a faster alternative.`,
      });
    }
  });

  // Every must-have needs a task, which is also what ties it to a category for Move money.
  for (const item of MustHave.options) {
    if (
      !tasks.tasks.some((task) =>
        task.activatedBy.some((when) => when.when === 'mustHave' && when.mustHave === item),
      )
    ) {
      problems.push({
        fileName: 'tasks.yaml',
        row: null,
        message: `No task is activated by the must-have "${item}".`,
      });
    }
  }
  if (
    !tasks.tasks.some((task) =>
      task.activatedBy.some((when) => when.when === 'need' && when.need === 'wheelchair'),
    )
  ) {
    problems.push({
      fileName: 'tasks.yaml',
      row: null,
      message: 'No task is activated by the wheelchair need.',
    });
  }

  // Diet and venue limits are served by asking (D14), so each needs a vendor question.
  const raised = vendorQuestions.questions.map((row) => row.raisedBy);
  for (const diet of Diet.options) {
    if (!raised.some((by) => by.when === 'diet' && by.diet === diet)) {
      problems.push({
        fileName: 'vendor-questions.yaml',
        row: null,
        message: `No question is raised by the diet "${diet}".`,
      });
    }
  }
  for (const limit of VenueLimit.options) {
    if (!raised.some((by) => by.when === 'venueLimit' && by.venueLimit === limit)) {
      problems.push({
        fileName: 'vendor-questions.yaml',
        row: null,
        message: `No question is raised by the venue limit "${limit}".`,
      });
    }
  }
  return problems;
}
