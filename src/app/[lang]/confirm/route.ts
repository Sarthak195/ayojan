import 'server-only';

import { resolveBrief } from '@/core/brief/confirm-brief';
import {
  defaultStepDeps,
  runStep,
  type StepContext,
  type StepDeps,
  type StepOutcome,
} from '@/server/http/post-step';

import { checkAgain, planFromBrief } from '../_brief/brief-steps';
import { confirmChangeWork } from '../p/[token]/_change/change-steps';
import { confirmQuote } from '../p/[token]/quotes/_quote/quote-steps';
import { briefAnswersOf, ConfirmForm } from './confirm-form';

export const dynamic = 'force-dynamic';

/**
 * Confirm or Cancel on the check page. Confirm appends the one op the reading stands for;
 * with a required value still unanswered it goes back to the check page with no op added
 * (FR-3). Cancel drops the pending reading and keeps the plan exactly as it was.
 */
function confirmWork(form: ConfirmForm, context: StepContext): StepOutcome {
  const opened = context.open(form.token);
  if (!opened.ok) return { kind: 'problem', problem: 'damaged-link' };
  const { state, data, today } = opened.plan;
  const { pending } = state;
  if (pending === undefined) return { kind: 'problem', problem: 'nothing-pending' };
  const { lang } = context;

  if (form.intent === 'cancel') {
    // A first brief has no plan to return to, and a link with no steps would not open.
    if (state.ops.length === 0) return { kind: 'redirect', to: { to: 'start', lang } };
    return {
      kind: 'next',
      state: { schema: 1, ops: state.ops },
      to: (token) => ({ to: 'plan', lang, token }),
    };
  }

  if (pending.kind === 'quote') return confirmQuote(form, pending, context);
  if (pending.kind === 'change') return confirmChangeWork(form, opened.plan, pending, lang);
  // A brief starts a plan, so one posted against a plan that already has steps is refused.
  if (state.ops.length > 0) {
    return { kind: 'problem', problem: 'cannot-apply' };
  }
  const resolution = resolveBrief(
    { draft: pending.values, answers: briefAnswersOf(form) },
    { today, weights: data.budgetWeights },
  );
  return resolution.ok
    ? planFromBrief(resolution.brief, pending.readBy, lang, data, today)
    : checkAgain(resolution.draft, pending.fields, pending.readBy, lang);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ lang: string }> },
  deps: StepDeps = defaultStepDeps(),
): Promise<Response> {
  return runStep(
    request,
    context.params,
    { route: '/[lang]/confirm', rateClass: 'step', schema: ConfirmForm, work: confirmWork },
    deps,
  );
}
