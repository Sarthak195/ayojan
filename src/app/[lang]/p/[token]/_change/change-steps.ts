import 'server-only';

import { z } from 'zod';

import { confirmChange, type ChangeFields } from '@/core/plan/change-answers';
import { changeQuestions } from '@/core/plan/change-questions';
import type { Lang } from '@/i18n/lang';
import type { CheckConfirm } from '@/schemas/forms/check-confirm';
import type { ChangeForm } from '@/schemas/forms/change-form';
import { TokenField } from '@/schemas/forms/form-field';
import type { StepContext, StepOutcome, StepSpec } from '@/server/http/post-step';
import { readChange } from '@/server/pipeline/read-change';
import { formReadBy } from '@/server/pipeline/reading-outcome';
import type { OpenedPlan } from '@/server/view/plan-page';

import type { ReadDeps } from '@/app/[lang]/read/[kind]/read-step';
import {
  appendChange,
  askAgain,
  headlineOf,
  prioritiesOf,
  typedNumber,
  valuesOfForm,
  type PendingChange,
} from './change-values';

const DAMAGED: StepOutcome = { kind: 'problem', problem: 'damaged-link' };

// Blank text is a 400, as for the brief; the 2,000 code point cap is readForm's 422.
export const ReadChangeForm = z.strictObject({
  token: TokenField,
  change: z.string().trim().min(1),
});

/**
 * G3: one model call on the change message, then the check page with the reading sealed next
 * to the plan's ops (a reload never calls the model), or back to the plan's change form with
 * the reason when the reader is unavailable. A read never appends an op (NFR-ALN-7).
 */
export function readChangeStep(deps: ReadDeps): StepSpec<typeof ReadChangeForm> {
  return {
    route: '/[lang]/read/[kind]',
    rateClass: 'model',
    schema: ReadChangeForm,
    work: async (form, context) => {
      const opened = context.open(form.token);
      if (!opened.ok) return DAMAGED;
      const { state, view, today } = opened.plan;
      // A first brief still on its check page has no plan to change yet.
      if (view === null) return { kind: 'problem', problem: 'cannot-apply' };
      const { lang } = context;
      const outcome = await readChange(deps, {
        text: form.change,
        today,
        eventDate: view.current.headline.eventDate,
      });
      if (outcome.kind === 'form') {
        return {
          kind: 'redirect',
          to: {
            to: 'plan',
            lang,
            token: form.token,
            anchor: 'change-form',
            unavailable: outcome.why,
          },
        };
      }
      return {
        kind: 'next',
        state: { schema: 1, ops: state.ops, pending: outcome.pending },
        to: (token) => ({ to: 'check', lang, token }),
      };
    },
  };
}

const NO_CHANGE: ChangeFields = {
  guests: null,
  budgetInr: null,
  eventDate: null,
  reallocate: null,
};

/**
 * The change form twin (FR-30): no model call. Valid values append the op at once; a value
 * outside the plan's bounds goes to the check page with its reason. A priority-only post is a
 * change too, though the change questions alone would call it "nothing to change".
 */
export function enterChangeWork(form: ChangeForm, context: StepContext): StepOutcome {
  const opened = context.open(form.token);
  if (!opened.ok) return DAMAGED;
  const { state, view, data, today } = opened.plan;
  if (view === null) return { kind: 'problem', problem: 'cannot-apply' };
  const { values, unreadable } = valuesOfForm(form);
  // A typed value that is not one whole number has no slot in the pending values, so it is
  // refused with the "send it again" page rather than silently dropped.
  if (unreadable) return { kind: 'problem', problem: 'malformed' };
  const priorities = prioritiesOf(form, view.current.priorities);
  const current = headlineOf(view);
  const readBy = formReadBy();
  const empty = changeQuestions(values, current, today).some(
    (question) => question.kind === 'nothing-to-change',
  );
  let fields = NO_CHANGE;
  if (!(empty && priorities !== null)) {
    const confirmed = confirmChange(values, { budgetInr: null, eventDate: null }, current, today);
    if (!confirmed.ok) {
      const pending: PendingChange = { kind: 'change', values, fields: [], readBy };
      return askAgain(state.ops, pending, context.lang);
    }
    fields = confirmed.fields;
  }
  return appendChange(
    state.ops,
    { kind: 'changeConfirmed', ...fields, priorities, sources: [], readBy },
    context.lang,
    data,
    today,
  );
}

/** The answers on the change check page: "By how much?" and "Which date?" (FR-24). */
function answersOf(
  form: CheckConfirm,
  pending: PendingChange,
  plan: OpenedPlan,
): { budgetInr: number | null; eventDate: string | null } {
  const { values } = pending;
  let budgetInr: number | null = null;
  if (form.budgetChoice === 'exact') {
    const typed = typedNumber(form.budgetExact ?? '');
    budgetInr = typeof typed === 'number' ? typed : null;
  } else if (form.budgetChoice === 'percent5' || form.budgetChoice === 'percent10') {
    const percent = form.budgetChoice === 'percent5' ? 5 : 10;
    if (plan.view !== null) {
      const asked = changeQuestions(values, headlineOf(plan.view), plan.today).find(
        (question) => question.kind === 'budget-how-much',
      );
      const option =
        asked?.kind === 'budget-how-much'
          ? asked.options.find((candidate) => candidate.percent === percent)
          : undefined;
      budgetInr = option?.budgetInr ?? null;
    }
  }
  // buildChange lists the shifted date first and the written one second; "Which date?" is
  // asked only when both are there, so the two choices map onto them by position.
  const eventDate =
    form.dateChoice === 'shift'
      ? (values.dateCandidates[0] ?? null)
      : form.dateChoice === 'written'
        ? (values.dateCandidates[1] ?? null)
        : null;
  return { budgetInr, eventDate };
}

/**
 * "Apply this change": with every question answered, one changeConfirmed op is appended and
 * the revision page shows what it did. An unanswered question returns to the check page with
 * no op, so nothing is ever chosen for the family.
 */
export function confirmChangeWork(
  form: CheckConfirm,
  plan: OpenedPlan,
  pending: PendingChange,
  lang: Lang,
): StepOutcome {
  const { state, view, data, today } = plan;
  if (view === null) return { kind: 'problem', problem: 'cannot-apply' };
  const confirmed = confirmChange(
    pending.values,
    answersOf(form, pending, plan),
    headlineOf(view),
    today,
  );
  if (!confirmed.ok) return askAgain(state.ops, pending, lang);
  return appendChange(
    state.ops,
    {
      kind: 'changeConfirmed',
      ...confirmed.fields,
      priorities: null,
      sources: pending.values.sources,
      readBy: pending.readBy,
    },
    lang,
    data,
    today,
  );
}
