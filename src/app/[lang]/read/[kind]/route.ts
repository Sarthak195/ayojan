import 'server-only';

import { isLang } from '@/i18n/lang';
import { runStep } from '@/server/http/post-step';
import { problemResponse } from '@/server/http/problem-page';

import { defaultReadDeps, readBriefStep, type ReadDeps } from './read-step';

export const dynamic = 'force-dynamic';

/**
 * POST /[lang]/read/[kind]. Only the brief is read here so far; an unknown kind is a 404
 * before the rate limit or the body is touched. `deps` is for tests: Next passes two
 * arguments, so production always gets the real gateway, limiter and seal key.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ lang: string; kind: string }> },
  deps: ReadDeps = defaultReadDeps(),
): Promise<Response> {
  const { lang, kind } = await context.params;
  if (kind !== 'brief') {
    return problemResponse({ lang: isLang(lang) ? lang : 'en', problem: 'not-found' });
  }
  return runStep(request, Promise.resolve({ lang }), readBriefStep(deps), deps);
}
