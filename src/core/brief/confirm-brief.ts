// Settles a brief: the reading's (or form's) values plus the answers from the check page
// become either a confirmed Brief or the questions still open. Budget, guests and the event
// date must be answered and the occasion must be known; functions, priorities, must-haves,
// needs, diet and venue limits may stay "not sure" (an unclear priority counts as standard
// when the budget is split, so it is kept as unclear, never turned into a choice).

import type { IsoDate } from '@/core/calendar/day-number';
import { profileForOccasion } from '@/core/budget/budget-profile';
import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';
import type { BriefForm } from '@/schemas/forms/brief-form';
import type { Brief } from '@/schemas/plan/brief';
import {
  Category,
  FunctionName,
  Occasion,
  type Occasion as OccasionName,
} from '@/schemas/readings/vocabulary';

import {
  BRIEF_BOUNDS,
  inputFromForm,
  type BriefAnswers,
  type BriefDraft,
  type BriefInput,
} from './brief-draft';
import { resolveCount, type Resolved } from './count-answer';
import { resolveEventDate } from './date-answer';
import { ask, inFieldOrder, type BriefQuestion } from './questions';

export interface BriefContext {
  /** The current date in India, passed in because src/core reads no clock. */
  readonly today: IsoDate;
  /** The budget data, which says which profile each occasion uses (D38). */
  readonly weights: BudgetWeightsFile;
}

/**
 * `draft` always holds everything understood so far, including a value that failed a bound
 * (0 guests, a passed date), so the check page can show it beside its reason and keep the
 * valid answers instead of starting over.
 */
export type BriefResolution =
  | { readonly ok: true; readonly brief: Brief; readonly draft: BriefDraft }
  | {
      readonly ok: false;
      readonly questions: readonly BriefQuestion[];
      readonly draft: BriefDraft;
    };

function resolveOccasion(
  kept: OccasionName | null,
  answer: string | null | undefined,
  weights: BudgetWeightsFile,
): Resolved<OccasionName | null> {
  const text = (answer === undefined ? kept : answer)?.trim() ?? '';
  if (text === '') return { value: null, question: ask('occasion', 'missing') };
  const parsed = Occasion.safeParse(text);
  if (!parsed.success) return { value: null, question: ask('occasion', 'unreadable', text) };
  const mapped = profileForOccasion(weights, parsed.data);
  const question = mapped.ok ? null : ask('occasion', 'no-profile', parsed.data);
  return { value: parsed.data, question };
}

function distinct<T>(answered: readonly T[] | undefined, kept: readonly T[]): T[] {
  return [...new Set(answered ?? kept)];
}

// Every function and category keeps an explicit answer; one the page did not name keeps the
// reading's, and the reading starts every row at "not sure".
function overlay<K extends string, V>(
  keys: readonly K[],
  base: Record<K, V>,
  changes: Partial<Record<K, V>> | undefined,
): Record<K, V> {
  const merged = { ...base };
  for (const key of keys) {
    const change = changes?.[key];
    if (change !== undefined) merged[key] = change;
  }
  return merged;
}

function chosen(draft: BriefDraft, answers: BriefAnswers): Omit<BriefDraft, ScalarKeys> {
  return {
    functions: overlay(FunctionName.options, draft.functions, answers.functions),
    priorities: overlay(Category.options, draft.priorities, answers.priorities),
    mustHaves: distinct(answers.mustHaves, draft.mustHaves),
    needs: distinct(answers.needs, draft.needs),
    diet: distinct(answers.diet, draft.diet),
    venueLimits: distinct(answers.venueLimits, draft.venueLimits),
    notes: draft.notes.slice(0, 6),
  };
}

type ScalarKeys = 'occasion' | 'budgetInr' | 'guests' | 'eventDate' | 'venueCapacity';

/** The one place a Brief is made, for the reader path and the form twin alike. */
export function resolveBrief(input: BriefInput, context: BriefContext): BriefResolution {
  const { draft, answers } = input;
  const occasion = resolveOccasion(draft.occasion, answers.occasion, context.weights);
  const budget = resolveCount(
    'budget',
    draft.budgetInr,
    answers.budget,
    BRIEF_BOUNDS.budgetInr,
    true,
  );
  const guests = resolveCount('guests', draft.guests, answers.guests, BRIEF_BOUNDS.guests, true);
  const date = resolveEventDate(draft.eventDate, answers.eventDate, context.today);
  const capacity = resolveCount(
    'venueCapacity',
    draft.venueCapacity,
    answers.venueCapacity,
    BRIEF_BOUNDS.venueCapacity,
    false,
  );
  const settled: BriefDraft = {
    occasion: occasion.value,
    budgetInr: budget.value,
    guests: guests.value,
    eventDate: date.value,
    venueCapacity: capacity.value,
    ...chosen(draft, answers),
  };
  const open = [occasion, budget, guests, date, capacity].flatMap(({ question }) =>
    question === null ? [] : [question],
  );
  if (
    open.length > 0 ||
    settled.occasion === null ||
    settled.budgetInr === null ||
    settled.guests === null ||
    settled.eventDate === null
  ) {
    return { ok: false, questions: inFieldOrder(open), draft: settled };
  }
  const brief: Brief = {
    ...settled,
    occasion: settled.occasion,
    budgetInr: settled.budgetInr,
    guests: settled.guests,
    eventDate: settled.eventDate,
  };
  return { ok: true, brief, draft: settled };
}

/** The form twin: same resolver, so a form brief equals the reader's for the same facts (FR-5). */
export function resolveFormBrief(form: BriefForm, context: BriefContext): BriefResolution {
  return resolveBrief(inputFromForm(form), context);
}
