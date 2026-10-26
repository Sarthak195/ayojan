import 'server-only';

import { LeverChoice } from '@/schemas/forms/lever-choice';
import type { StepOutcome, StepSpec } from '@/server/http/post-step';
import { appendOp } from '@/server/state/history';

import { candidateOp, checkTicked } from '../p/[token]/revision/_levers/lever-model';

const CANNOT_APPLY: StepOutcome = { kind: 'problem', problem: 'cannot-apply', status: 422 };

/**
 * POST /[lang]/levers. `preview` (Recalculate, the no-JavaScript path) checks the ticks and
 * 303s to the trade-offs with the lever ids in `?sel=`, a closed enum, so no new state is
 * sealed; `apply` appends one leversApplied op and 303s to the plan. Nothing is ever chosen
 * for the family (NFR-ALN-7): an empty Apply changes nothing and goes back to the choices.
 */
export const leverStep: StepSpec<typeof LeverChoice> = {
  route: '/[lang]/levers',
  rateClass: 'step',
  schema: LeverChoice,
  work: (form, context) => {
    const { lang } = context;
    const opened = context.open(form.token);
    if (!opened.ok) return { kind: 'problem', problem: 'damaged-link' };
    const { state, view, data, today } = opened.plan;
    if (view === null) return CANNOT_APPLY;
    const ticked = checkTicked(view.current, form.lever, form.showAnyway);
    if (!ticked.ok) return CANNOT_APPLY;
    const token = form.token;
    if (form.intent === 'preview') {
      return { kind: 'redirect', to: { to: 'revision', lang, token, selection: ticked.fresh } };
    }
    const op = candidateOp(state.ops, view, ticked.fresh, data, today);
    if (!op.ok) return CANNOT_APPLY;
    if (op.value === null) return { kind: 'redirect', to: { to: 'revision', lang, token } };
    const next = appendOp(state, op.value);
    if (!next.ok) return { kind: 'problem', problem: 'op-cap', status: 422 };
    return {
      kind: 'next',
      state: next.state,
      to: (sealed) => ({ to: 'plan', lang, token: sealed }),
    };
  },
};
