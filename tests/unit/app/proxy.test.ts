import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { proxy } from '@/proxy';

import { BRIEF_STATE, SEAL_KEY, seal } from '../server/http/step-support';

// The proxy opens plan links with the process key, so the test seals with the same one.
const TOKEN = seal(BRIEF_STATE);

// NextResponse.next({ request: { headers } }) carries each overridden request header to the
// app as `x-middleware-request-<name>`, which is what the root layout ends up reading.
function forwarded(response: Response, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name}`);
}

describe('proxy', () => {
  beforeEach(() => {
    vi.stubEnv('STATE_SEAL_KEY', SEAL_KEY.toString('base64'));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('passes the path language and the path to the layout', () => {
    const response = proxy(new NextRequest(`http://localhost/hi/p/${TOKEN}/quotes`));
    expect(forwarded(response, 'x-lang')).toBe('hi');
    expect(forwarded(response, 'x-pathname')).toBe(`/hi/p/${TOKEN}/quotes`);
  });

  it('answers a damaged plan link itself, with the policy and no forwarding', () => {
    const response = proxy(new NextRequest('http://localhost/hi/p/abc/quotes'));
    expect(response.status).toBe(404);
    expect(response.headers.get('content-security-policy')).toContain("'nonce-");
    expect(forwarded(response, 'x-lang')).toBeNull();
  });

  it('overwrites a language header the client sent', () => {
    const request = new NextRequest('http://localhost/en/form', {
      headers: { 'x-lang': 'hi', 'x-pathname': '//evil.example' },
    });
    const response = proxy(request);
    expect(forwarded(response, 'x-lang')).toBe('en');
    expect(forwarded(response, 'x-pathname')).toBe('/en/form');
  });

  it('falls back to English where the path names no language', () => {
    expect(forwarded(proxy(new NextRequest('http://localhost/api/health')), 'x-lang')).toBe('en');
  });

  it('still sends a fresh CSP nonce on every response', () => {
    const first = proxy(new NextRequest('http://localhost/en')).headers;
    const second = proxy(new NextRequest('http://localhost/en')).headers;
    expect(first.get('content-security-policy')).toContain("'nonce-");
    expect(first.get('content-security-policy')).not.toBe(second.get('content-security-policy'));
  });
});
