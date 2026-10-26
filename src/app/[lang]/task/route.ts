import 'server-only';

import { defaultStepDeps, runStep, type StepDeps } from '@/server/http/post-step';

import { taskStep } from './task-step';

export const dynamic = 'force-dynamic';

/**
 * POST /[lang]/task. `deps` is for tests: Next passes two arguments, so production always
 * gets the real limiter, clock, data and seal key.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ lang: string }> },
  deps: StepDeps = defaultStepDeps(),
): Promise<Response> {
  return runStep(request, context.params, taskStep, deps);
}
