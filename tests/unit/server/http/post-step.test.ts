import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { runStep, type StepOutcome, type StepSpec } from '@/server/http/post-step';
import { decodeState } from '@/server/state/token-codec';

import { worstCaseState } from '../../../fixtures/state';
import {
  BRIEF_STATE,
  deps,
  formRequest,
  keepingLogger,
  limiter,
  params,
  seal,
  SEAL_KEY,
} from './step-support';

const Form = z.strictObject({ token: z.string(), note: z.string().optional() });
type FormValue = z.output<typeof Form>;

function spec(
  work: (form: FormValue) => StepOutcome | Promise<StepOutcome>,
): StepSpec<typeof Form> & { readonly work: ReturnType<typeof vi.fn> } {
  return { route: '/[lang]/task', rateClass: 'step', schema: Form, work: vi.fn(work) };
}

const keepState = (): StepOutcome => ({
  kind: 'next',
  state: BRIEF_STATE,
  to: (token) => ({ to: 'plan', lang: 'en', token, anchor: 'tasks' }),
});

describe('runStep order and statuses', () => {
  it('refuses with 429 before the body is read, and says when to retry', async () => {
    const step = spec(keepState);
    const request = formRequest({ token: 'abc' }, 'application/json');
    const refusing = limiter({ allowed: false, reason: 'minute', retryAfterSeconds: 42 });
    const response = await runStep(request, params('en'), step, deps({ limiter: refusing }));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(await response.text()).toContain('Please wait 42 seconds');
    expect(request.bodyUsed).toBe(false);
    expect(step.work).not.toHaveBeenCalled();
  });

  it('checks the rate class the spec names', async () => {
    const counting = limiter();
    const step = { ...spec(keepState), rateClass: 'model' as const };
    await runStep(
      formRequest({ token: seal(BRIEF_STATE) }),
      params('en'),
      step,
      deps({ limiter: counting }),
    );
    expect(counting.calls).toEqual(['model']);
  });

  it.each([
    ['a JSON body', formRequest({ token: 'a' }, 'application/json'), 415],
    ['multipart', formRequest({ token: 'a' }, 'multipart/form-data; boundary=x'), 415],
    ['a body over 32 KiB', formRequest({ token: 'a', note: 'x'.repeat(33 * 1024) }), 413],
    ['an unknown field', formRequest({ token: 'a', extra: '1' }), 400],
    ['a missing field', formRequest({}), 400],
    ['free text over 2,000 code points', formRequest({ token: 'a', note: 'x'.repeat(2001) }), 422],
  ])('answers %s with its status and never runs the work', async (_name, request, status) => {
    const step = spec(keepState);
    const response = await runStep(request, params('en'), step, deps());
    expect(response.status).toBe(status);
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(step.work).not.toHaveBeenCalled();
  });

  it('answers an unknown language with 404 and touches nothing', async () => {
    const counting = limiter();
    const response = await runStep(
      formRequest({ token: 'a' }),
      params('fr'),
      spec(keepState),
      deps({ limiter: counting }),
    );
    expect(response.status).toBe(404);
    expect(counting.calls).toEqual([]);
  });

  it('seals the next state and answers 303 to a relative Location', async () => {
    const response = await runStep(
      formRequest({ token: seal(BRIEF_STATE) }),
      params('en'),
      spec(keepState),
      deps(),
    );
    expect(response.status).toBe(303);
    const location = response.headers.get('Location') ?? '';
    expect(location).toMatch(/^\/en\/p\/[A-Za-z0-9_-]+#tasks$/);
    const token = location.slice('/en/p/'.length, -'#tasks'.length);
    const decoded = decodeState(token, SEAL_KEY);
    expect(decoded.ok && decoded.state).toEqual(BRIEF_STATE);
  });

  it('passes a redirect through as a 303', async () => {
    const step = spec(() => ({
      kind: 'redirect',
      to: { to: 'form', lang: 'hi', unavailable: 'quota' },
    }));
    const response = await runStep(formRequest({ token: 'a' }), params('hi'), step, deps());
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/hi/form?ai=unavailable&why=quota');
  });

  it('refuses a step whose link would be over 4,000 characters with the D39 page (422)', async () => {
    const before = seal(BRIEF_STATE);
    const step = spec(() => ({
      kind: 'next',
      state: worstCaseState(12, 'syllables'),
      to: (token) => ({ to: 'plan', lang: 'en', token }),
    }));
    const response = await runStep(formRequest({ token: before }), params('en'), step, deps());
    expect(response.status).toBe(422);
    const page = await response.text();
    expect(page).toContain('This plan&#39;s link is full; undo a step or start a new plan.');
    expect(page).toContain(`href="/en/p/${before}"`);
  });

  it('refuses a 41st step with the 40-step page (422)', async () => {
    const [brief] = BRIEF_STATE.ops;
    if (brief === undefined) throw new Error('fixture');
    const step = spec(() => ({
      kind: 'next',
      state: { schema: 1, ops: Array.from({ length: 41 }, () => brief) },
      to: (token) => ({ to: 'plan', lang: 'en', token }),
    }));
    const response = await runStep(
      formRequest({ token: seal(BRIEF_STATE) }),
      params('en'),
      step,
      deps(),
    );
    expect(response.status).toBe(422);
    expect(await response.text()).toContain('This plan has reached 40 steps');
  });

  it('opens the posted token for the work and maps a damaged one to 400', async () => {
    const step: StepSpec<typeof Form> = {
      route: '/[lang]/undo',
      rateClass: 'step',
      schema: Form,
      work: (form, context) => {
        const opened = context.open(form.token);
        return opened.ok ? keepState() : { kind: 'problem', problem: 'damaged-link' };
      },
    };
    const damaged = await runStep(formRequest({ token: 'tampered' }), params('en'), step, deps());
    expect(damaged.status).toBe(400);
    expect(await damaged.text()).toContain('This link cannot be opened');
    const fine = await runStep(
      formRequest({ token: seal(BRIEF_STATE) }),
      params('en'),
      step,
      deps(),
    );
    expect(fine.status).toBe(303);
  });

  it('turns a throw into a 500 with no detail, logging only the class name', async () => {
    const logger = keepingLogger();
    const step = spec(() => {
      throw new TypeError('Nani wheelchair 1300/plate');
    });
    const response = await runStep(
      formRequest({ token: 'a' }),
      params('en'),
      step,
      deps({ logger }),
    );
    expect(response.status).toBe(500);
    const page = await response.text();
    expect(page).not.toContain('Nani');
    expect(page).not.toContain('TypeError');
    expect(logger.lines).toContainEqual({
      level: 'error',
      event: 'step-failed',
      fields: { route: '/[lang]/task', errorName: 'TypeError' },
    });
  });

  it('logs the route template, status and duration of every step', async () => {
    const logger = keepingLogger();
    let tick = 1_000;
    await runStep(formRequest({ token: seal(BRIEF_STATE) }), params('en'), spec(keepState), {
      ...deps({ logger }),
      now: () => (tick += 5),
    });
    expect(logger.lines.at(-1)).toEqual({
      level: 'info',
      event: 'step',
      fields: { route: '/[lang]/task', status: 303, durationMs: 5 },
    });
  });
});
