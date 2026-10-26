import 'server-only';

import type { IsoDate } from '@/core/calendar/day-number';
import type { CurrentHeadline } from '@/core/plan/change-questions';
import { viewOfOps, type PlanView } from '@/core/plan/plan-view';
import { parseAmount } from '@/core/rupees/parse';
import type { Lang } from '@/i18n/lang';
import type { DataDocuments } from '@/schemas/data/data-files';
import type { ChangeForm } from '@/schemas/forms/change-form';
import { MAX_OPS, Op } from '@/schemas/plan/op';
import type { PendingReading } from '@/schemas/plan/state-token';
import { Category, type Priority } from '@/schemas/readings/vocabulary';
import type { StepOutcome } from '@/server/http/post-step';

// The pieces the three change steps (read, form twin, confirm) share, so a change made by
// either path is checked, appended and redirected identically (FR-30).

export type PendingChange = Extract<PendingReading, { kind: 'change' }>;
export type ChangeOp = Extract<Op, { kind: 'changeConfirmed' }>;

/** The plan's headline as the change questions measure it: what "50 more" is added to. */
export function headlineOf(view: PlanView): CurrentHeadline {
  const { headline } = view.current;
  return { guests: headline.guests, budgetInr: headline.budget.inr, eventDate: headline.eventDate };
}

// parseAmount skips a minus as punctuation, so "-5" would read as 5; a sign is refused here.
const LEADING_MINUS = /(?:^|[^\p{L}\p{N}])[-−–]\s*\p{N}/u;

/**
 * A typed count or amount ("250", "7.5 lakh"): null when left empty, 'unreadable' when it is
 * not exactly one whole non-negative number. Range checks belong to the change questions.
 */
export function typedNumber(text: string): number | null | 'unreadable' {
  if (text.trim() === '') return null;
  if (LEADING_MINUS.test(text)) return 'unreadable';
  const parsed = parseAmount(text);
  return parsed.kind === 'amount' ? parsed.inr : 'unreadable';
}

type PriorityChoice = '' | Exclude<Priority, 'unclear'>;

/**
 * The form's priority rows laid over the current priorities (D13). Op.priorities holds every
 * category, so the untouched rows keep their current value; null when no row differs.
 */
export function prioritiesOf(
  form: ChangeForm,
  current: Readonly<Record<Category, Priority>>,
): Record<Category, Priority> | null {
  const rows: Readonly<Record<Category, PriorityChoice>> = {
    venue: form.priorityVenue,
    catering: form.priorityCatering,
    decor: form.priorityDecor,
    photo: form.priorityPhoto,
    music: form.priorityMusic,
    invites: form.priorityInvites,
    contingency: form.priorityContingency,
  };
  const next: Record<Category, Priority> = { ...current };
  let differs = false;
  for (const category of Category.options) {
    const choice = rows[category];
    if (choice === '' || choice === current[category]) continue;
    next[category] = choice;
    differs = true;
  }
  return differs ? next : null;
}

export interface FormValues {
  readonly values: PendingChange['values'];
  readonly unreadable: boolean;
}

/** The form twin's fields as change values: every typed value is a new total, never a delta. */
export function valuesOfForm(form: ChangeForm): FormValues {
  const guests = typedNumber(form.guests);
  const budget = typedNumber(form.budget);
  const moveAmount = typedNumber(form.moveAmount);
  const unreadable =
    guests === 'unreadable' || budget === 'unreadable' || moveAmount === 'unreadable';
  const amount = moveAmount === 'unreadable' ? null : moveAmount;
  const moveTo = form.moveTo === '' ? null : form.moveTo;
  return {
    unreadable,
    values: {
      guests: typeof guests === 'number' ? { mode: 'absolute', count: guests } : null,
      budget:
        typeof budget === 'number'
          ? { mode: 'absolute', direction: 'none', amountInr: budget }
          : null,
      dateCandidates: form.eventDate === null ? [] : [form.eventDate],
      reallocate: amount === null && moveTo === null ? null : { to: moveTo, amountInr: amount },
      sources: [],
    },
  };
}

/**
 * Appends the confirmed change and 303s to the revision page (D32). The plan is folded once
 * here so a change the engines refuse is a 422 on this step, never a sealed link that would
 * only open as "damaged".
 */
export function appendChange(
  ops: readonly Op[],
  candidate: ChangeOp,
  lang: Lang,
  data: DataDocuments,
  today: IsoDate,
): StepOutcome {
  if (ops.length >= MAX_OPS) return { kind: 'problem', problem: 'op-cap' };
  const op = Op.safeParse(candidate);
  if (!op.success) return { kind: 'problem', problem: 'cannot-apply' };
  const next = [...ops, op.data];
  if (!viewOfOps(next, data, today).ok) return { kind: 'problem', problem: 'cannot-apply' };
  return {
    kind: 'next',
    state: { schema: 1, ops: next },
    to: (token) => ({ to: 'revision', lang, token }),
  };
}

/** Back to the check page with the change still pending and no op added (FR-24). */
export function askAgain(ops: readonly Op[], pending: PendingChange, lang: Lang): StepOutcome {
  return {
    kind: 'next',
    state: { schema: 1, ops: [...ops], pending },
    to: (token) => ({ to: 'check', lang, token }),
  };
}
