// Which of the data's task templates belong in this plan (architecture 4.6, FR-11). The templates
// are the only source of tasks: nothing here names a task, so adding a template to the data adds
// it to every plan whose brief activates it.

import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';
import type { TaskRow } from '@/schemas/data/tasks';
import type { FunctionAnswer } from '@/schemas/plan/brief';
import type { Category, FunctionName, GuestNeed, MustHave } from '@/schemas/readings/vocabulary';

/** The budget profile an occasion maps to in data (D15, D38); the caller resolves it. */
export type OccasionProfile = BudgetWeightsFile['profiles'][number]['id'];

/** The parts of a confirmed brief that decide which tasks exist. */
export interface TaskNeeds {
  readonly functions: Readonly<Partial<Record<FunctionName, FunctionAnswer>>>;
  readonly mustHaves: readonly MustHave[];
  readonly needs: readonly GuestNeed[];
}

export interface TaskSelection {
  /** Active templates in data order, with the profile's day counts applied. */
  readonly active: readonly TaskRow[];
  /** Every template id in the data, active or not, so a dependency on a dropped template can be told from a typo. */
  readonly knownIds: ReadonlySet<string>;
}

/** A template with the faster alternative applied or not: the only shape the scheduler reads. */
export interface ResolvedTask {
  readonly id: string;
  readonly category: Category;
  readonly en: string;
  readonly hi: string;
  readonly dependsOn: readonly string[];
  readonly latestFinishDaysBefore: number;
  readonly durationDays: number;
  readonly books: Category | null;
  readonly fasterApplied: boolean;
}

function isActive(row: TaskRow, needs: TaskNeeds): boolean {
  return row.activatedBy.some((rule) => {
    switch (rule.when) {
      case 'always':
        return true;
      case 'function':
        // Only a "yes" adds a task. "Unsure" is a question still open, and guessing a
        // function would put work on the list that the family never asked for.
        return needs.functions[rule.function] === 'yes';
      case 'mustHave':
        return needs.mustHaves.includes(rule.mustHave);
      case 'need':
        return needs.needs.includes(rule.need);
    }
  });
}

// The small celebration's own day counts replace the wedding's (D40), so everything after
// selection, the scheduler and the faster alternative included, reads one set of numbers.
function timedFor(row: TaskRow, profile: OccasionProfile): TaskRow {
  if (profile !== 'celebration' || row.celebration === null) return row;
  const { latestFinishDaysBefore, durationDays } = row.celebration;
  const faster = row.fasterAlternative;
  return {
    ...row,
    latestFinishDaysBefore,
    durationDays,
    fasterAlternative: faster?.celebration ? { ...faster, ...faster.celebration } : faster,
  };
}

export function selectTasks(
  templates: readonly TaskRow[],
  needs: TaskNeeds,
  profile: OccasionProfile,
): TaskSelection {
  const active = templates
    // A small celebration has no mandap or haldi: those templates are wedding-only in data.
    .filter((row) => !(row.weddingOnly && profile === 'celebration') && isActive(row, needs))
    .map((row) => timedFor(row, profile));
  return { active, knownIds: new Set(templates.map((row) => row.id)) };
}

/**
 * The template as the scheduler sees it. The faster alternative (the e-invites lever, FR-33)
 * replaces the name and the two day counts and nothing else, so a lever never edits the data.
 */
export function resolveTask(row: TaskRow, useFasterAlternative: boolean): ResolvedTask {
  const faster = useFasterAlternative ? row.fasterAlternative : null;
  return {
    id: row.id,
    category: row.category,
    en: faster?.en ?? row.en,
    hi: faster?.hi ?? row.hi,
    dependsOn: row.dependsOn,
    latestFinishDaysBefore: faster?.latestFinishDaysBefore ?? row.latestFinishDaysBefore,
    durationDays: faster?.durationDays ?? row.durationDays,
    books: row.books,
    fasterApplied: faster !== null,
  };
}
