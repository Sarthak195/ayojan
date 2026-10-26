import 'server-only';

import { runStep } from '@/server/http/post-step';

import { defaultMessageDeps, messageStep, type MessageDeps } from './message-step';

export const dynamic = 'force-dynamic';

/**
 * POST /[lang]/messages ("Write it with AI"). `deps` is for tests: Next passes two arguments,
 * so production always gets the real gateway, limiter and seal key.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ lang: string }> },
  deps: MessageDeps = defaultMessageDeps(),
): Promise<Response> {
  return runStep(request, context.params, messageStep(deps), deps);
}
