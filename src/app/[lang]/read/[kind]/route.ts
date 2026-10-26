import 'server-only';

import { isLang } from '@/i18n/lang';
import { runStep } from '@/server/http/post-step';
import { problemResponse } from '@/server/http/problem-page';

import { readChangeStep } from '../../p/[token]/_change/change-steps';
import { readQuoteStep } from '../../p/[token]/quotes/_quote/quote-steps';
import { defaultReadDeps, readBriefStep, type ReadDeps } from './read-step';

export const dynamic = 'force-dynamic';

/**
 * POST /[lang]/read/[kind] for a brief, a vendor quote or a change; an unknown kind is a 404
 * before the rate limit or the body is touched. `deps` is for tests: Next passes two
 * arguments, so production always gets the real gateway, limiter and seal key.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ lang: string; kind: string }> },
  deps: ReadDeps = defaultReadDeps(),
): Promise<Response> {
  const { lang, kind } = await context.params;
  if (kind === 'quote')
    return runStep(request, Promise.resolve({ lang }), readQuoteStep(deps), deps);
  if (kind === 'change')
    return runStep(request, Promise.resolve({ lang }), readChangeStep(deps), deps);
  if (kind !== 'brief') {
    return problemResponse({ lang: isLang(lang) ? lang : 'en', problem: 'not-found' });
  }
  return runStep(request, Promise.resolve({ lang }), readBriefStep(deps), deps);
}
