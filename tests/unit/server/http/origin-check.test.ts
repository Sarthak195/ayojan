// A cross-site POST is refused before the rate limit, so a page on another site cannot make a
// visitor's browser spend the shared model quota. Same-site posts and header-less clients pass.

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { runStep, type StepSpec } from '@/server/http/post-step';
import { isCrossSite } from '@/server/http/origin-check';

import { BRIEF_STATE, deps, formRequest, limiter, params, seal } from './step-support';

const Form = z.strictObject({ token: z.string() });

function spec(): StepSpec<typeof Form> & { readonly work: ReturnType<typeof vi.fn> } {
  const work = vi.fn(() => ({
    kind: 'redirect' as const,
    to: { to: 'start' as const, lang: 'en' as const },
  }));
  return { route: '/[lang]/task', rateClass: 'model', schema: Form, work };
}

const HOST = 'ayojan-abc-el.a.run.app';
const post = (headers: Record<string, string>) =>
  formRequest({ token: seal(BRIEF_STATE) }, undefined, headers);

describe('cross-site POSTs', () => {
  it.each([
    ['a foreign Origin', { host: HOST, origin: 'https://evil.example' }],
    ['the literal null Origin', { host: HOST, origin: 'null' }],
    ['Sec-Fetch-Site: cross-site', { host: HOST, 'sec-fetch-site': 'cross-site' }],
    [
      'Sec-Fetch-Site: cross-site even with a matching Origin',
      { host: HOST, origin: `https://${HOST}`, 'sec-fetch-site': 'cross-site' },
    ],
    ['an Origin on another port', { host: HOST, origin: `https://${HOST}:8443` }],
  ])('answers %s with 403 before the rate limit and the body', async (_name, headers) => {
    const counting = limiter({ allowed: false, reason: 'minute', retryAfterSeconds: 9 });
    const step = spec();
    const request = post(headers);
    const response = await runStep(request, params('en'), step, deps({ limiter: counting }));
    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(counting.calls).toEqual([]);
    expect(request.bodyUsed).toBe(false);
    expect(step.work).not.toHaveBeenCalled();
  });

  it('says what happened in Hindi too', async () => {
    const response = await runStep(
      post({ host: HOST, origin: 'https://evil.example' }),
      params('hi'),
      spec(),
      deps(),
    );
    expect(response.status).toBe(403);
    expect(await response.text()).toContain('दूसरी साइट');
  });
});

describe('same-site and header-less POSTs', () => {
  it.each([
    ['an Origin matching Host', { host: HOST, origin: `https://${HOST}` }],
    [
      'an Origin matching Host in another case',
      { host: HOST, origin: `https://${HOST.toUpperCase()}` },
    ],
    [
      'an Origin matching X-Forwarded-Host',
      { host: '0.0.0.0:8080', 'x-forwarded-host': HOST, origin: `https://${HOST}` },
    ],
    ['same-origin Sec-Fetch-Site with no Origin', { host: HOST, 'sec-fetch-site': 'same-origin' }],
    ['no Origin and no Sec-Fetch-Site (curl)', {}],
  ])('lets %s through to the rate limit and the work', async (_name, headers) => {
    const counting = limiter();
    const step = spec();
    const response = await runStep(post(headers), params('en'), step, deps({ limiter: counting }));
    expect(response.status).toBe(303);
    expect(counting.calls).toEqual(['model']);
    expect(step.work).toHaveBeenCalledOnce();
  });

  it('matches only the first X-Forwarded-Host entry and never request.url', () => {
    const headers = (extra: Record<string, string>) =>
      new Headers({ origin: 'http://localhost', ...extra });
    expect(isCrossSite(headers({}))).toBe(true);
    expect(isCrossSite(headers({ 'x-forwarded-host': 'evil.example, localhost' }))).toBe(true);
    expect(isCrossSite(headers({ 'x-forwarded-host': 'localhost, evil.example' }))).toBe(false);
  });
});
