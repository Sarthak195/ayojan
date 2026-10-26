import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { proxy } from '@/proxy';

// NextResponse.next({ request: { headers } }) carries each overridden request header to the
// app as `x-middleware-request-<name>`, which is what the root layout ends up reading.
function forwarded(response: Response, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name}`);
}

describe('proxy', () => {
  it('passes the path language and the path to the layout', () => {
    const response = proxy(new NextRequest('http://localhost/hi/p/abc/quotes'));
    expect(forwarded(response, 'x-lang')).toBe('hi');
    expect(forwarded(response, 'x-pathname')).toBe('/hi/p/abc/quotes');
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
