import 'server-only';

import { z } from 'zod';

import { undo } from '@/core/plan/fold';
import { TokenField } from '@/schemas/forms/form-field';
import {
  defaultStepDeps,
  runStep,
  type StepContext,
  type StepDeps,
  type StepOutcome,
} from '@/server/http/post-step';

export const dynamic = 'force-dynamic';

const UndoForm = z.strictObject({ token: TokenField });

/**
 * "Undo last step" (FR-29): the plan is a fold of its ops, so undoing is dropping the last
 * one, whatever kind it was. A pending reading goes too, since it was read against the step
 * being undone. Only the brief left is a 422: there is no plan without it.
 */
function undoWork(form: z.infer<typeof UndoForm>, context: StepContext): StepOutcome {
  const opened = context.open(form.token);
  if (!opened.ok) return { kind: 'problem', problem: 'damaged-link' };
  const result = undo(opened.plan.state.ops);
  if (!result.ok) return { kind: 'problem', problem: 'nothing-to-undo' };
  const { lang } = context;
  return {
    kind: 'next',
    state: { schema: 1, ops: [...result.ops] },
    to: (token) => ({ to: 'plan', lang, token }),
  };
}

/** POST /[lang]/undo. `deps` is for tests; Next passes two arguments, so production uses the defaults. */
export async function POST(
  request: Request,
  context: { params: Promise<{ lang: string }> },
  deps: StepDeps = defaultStepDeps(),
): Promise<Response> {
  return runStep(
    request,
    context.params,
    { route: '/[lang]/undo', rateClass: 'step', schema: UndoForm, work: undoWork },
    deps,
  );
}
