import 'server-only';

import type { z } from 'zod';

import { isLang, type Lang } from '@/i18n/lang';
import type { ProblemKind } from '@/i18n/problem-text';
import type { StateToken } from '@/schemas/plan/state-token';

import { systemNow, type Now } from '../config/clock';
import { log, type Logger } from '../observability/logger';
import { clientKeyOf } from '../ratelimit/client-key';
import { rateLimiter, type RateClass, type RateLimiter } from '../ratelimit/rate-limit';
import { encodeState } from '../state/token-codec';
import { defaultPlanSources, openPlan, type OpenResult, type PlanSources } from '../view/plan-page';
import { readForm, type FormRefusal } from './form-body';
import { problemResponse } from './problem-page';
import { seeOther, type Destination } from './see-other';

/** What a step's work can use besides its form. */
export interface StepContext {
  readonly lang: Lang;
  readonly sources: PlanSources;
  /** Opens a posted token; on failure return `{ kind: 'problem', problem: 'damaged-link' }`. */
  open(token: string): OpenResult;
}

/**
 * The work's answer. `next` is a new state to seal, then a 303 to `to(token)`; `redirect` is a
 * 303 with no new state (a read that fell back to the form); `problem` is a problem page.
 */
export type StepOutcome =
  | {
      readonly kind: 'next';
      readonly state: StateToken;
      readonly to: (token: string) => Destination;
    }
  | { readonly kind: 'redirect'; readonly to: Destination }
  | { readonly kind: 'problem'; readonly problem: ProblemKind; readonly status?: number };

export interface StepSpec<S extends z.ZodType> {
  /** The route template for logs, e.g. `/[lang]/task`; never the path, which holds a token. */
  readonly route: string;
  readonly rateClass: RateClass;
  readonly schema: S;
  readonly work: (form: z.output<S>, context: StepContext) => StepOutcome | Promise<StepOutcome>;
}

export interface StepDeps extends PlanSources {
  readonly limiter: RateLimiter;
  readonly logger: Logger;
  readonly now: Now;
}

export function defaultStepDeps(): StepDeps {
  return { ...defaultPlanSources(), limiter: rateLimiter(), logger: log, now: systemNow };
}

const FORM_PROBLEM: Readonly<Record<FormRefusal, ProblemKind>> = {
  'wrong-type': 'wrong-type',
  'too-large': 'too-large',
  malformed: 'malformed',
  invalid: 'text-too-long',
};

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{1,4000}$/;

// A problem after the form parsed links back to the plan the user came from, so "undo a step"
// is one tap away. Only a token-shaped value is used; locationOf checks it again.
function backTo(lang: Lang, form: unknown): Destination | undefined {
  if (typeof form !== 'object' || form === null || !('token' in form)) return undefined;
  const { token } = form;
  return typeof token === 'string' && TOKEN_SHAPE.test(token)
    ? { to: 'plan', lang, token }
    : undefined;
}

/** Thrown when the work hands back a state the codec calls invalid: our bug, so a 500. */
class InvalidStateError extends Error {
  override readonly name = 'InvalidStateError';
}

async function respond<S extends z.ZodType>(
  request: Request,
  lang: Lang,
  spec: StepSpec<S>,
  deps: StepDeps,
): Promise<Response> {
  // 1. Rate limit, before a single body byte is read (arch 6.3).
  const decision = deps.limiter.check(spec.rateClass, clientKeyOf(request.headers));
  if (!decision.allowed) {
    const { retryAfterSeconds } = decision;
    return problemResponse({ lang, problem: 'too-many-requests', retryAfterSeconds });
  }
  // 2. Content type, size, encoding, form shape, text cap.
  const form = await readForm(request, spec.schema);
  if (!form.ok) {
    return problemResponse({ lang, problem: FORM_PROBLEM[form.reason], status: form.status });
  }
  // 3. The step itself.
  const back = backTo(lang, form.value);
  const context: StepContext = {
    lang,
    sources: deps,
    open: (token) => openPlan(token, deps),
  };
  const outcome = await spec.work(form.value, context);
  if (outcome.kind === 'redirect') return seeOther(outcome.to);
  if (outcome.kind === 'problem') {
    // A damaged token cannot be linked back to.
    const link = outcome.problem === 'damaged-link' ? undefined : back;
    return problemResponse({
      lang,
      problem: outcome.problem,
      ...(outcome.status === undefined ? {} : { status: outcome.status }),
      ...(link === undefined ? {} : { back: link }),
    });
  }
  // 4. Seal; a link that would outgrow the cap is refused with the plan unchanged (D39).
  const sealed = encodeState(outcome.state, deps.sealKey());
  if (!sealed.ok) {
    if (sealed.reason === 'invalid-shape')
      throw new InvalidStateError('Step built an invalid state.');
    const problem = sealed.reason === 'too-long' ? 'link-full' : 'op-cap';
    return problemResponse({ lang, problem, ...(back === undefined ? {} : { back }) });
  }
  // 5. 303 to a relative Location built from fixed routes and the token.
  return seeOther(outcome.to(sealed.token));
}

/**
 * Runs a POST route handler in the order of arch 6.3: language, rate limit, readForm, the
 * work, encodeState, seeOther. Any throw becomes a 500 page with no detail; the log line
 * carries the error's class name only, because a message can quote user input.
 */
export async function runStep<S extends z.ZodType>(
  request: Request,
  params: Promise<{ lang: string }>,
  spec: StepSpec<S>,
  deps: StepDeps = defaultStepDeps(),
): Promise<Response> {
  const started = deps.now();
  let lang: Lang = 'en';
  let response: Response;
  try {
    const raw = (await params).lang;
    if (isLang(raw)) {
      lang = raw;
      response = await respond(request, lang, spec, deps);
    } else {
      response = problemResponse({ lang, problem: 'not-found' });
    }
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    deps.logger.error('step-failed', { route: spec.route, errorName });
    response = problemResponse({ lang, problem: 'server-error' });
  }
  deps.logger.info('step', {
    route: spec.route,
    status: response.status,
    durationMs: Math.max(0, deps.now() - started),
  });
  return response;
}
