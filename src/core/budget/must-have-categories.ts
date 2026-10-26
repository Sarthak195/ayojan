// Which categories a must-have protects. The link is read from the task data (the task a
// must-have activates belongs to a category), so there is no second table to keep in step
// with data/tasks.yaml.

import type { TasksFile } from '@/schemas/data/tasks';
import { categories, type Category, type MustHave } from '@/schemas/readings/vocabulary';

export function categoriesTiedToMustHaves(
  mustHaves: readonly MustHave[],
  tasks: TasksFile['tasks'],
): readonly Category[] {
  const tied = new Set<Category>();
  for (const task of tasks) {
    const named = task.activatedBy.some(
      (condition) => condition.when === 'mustHave' && mustHaves.includes(condition.mustHave),
    );
    if (named) tied.add(task.category);
  }
  // Vocabulary order, so the result does not depend on the order of the task rows.
  return categories.filter((category) => tied.has(category));
}
