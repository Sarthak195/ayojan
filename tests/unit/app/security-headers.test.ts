// The headers every response carries, checked where they are produced: the fixed set in
// next.config.ts and the per-request policy the proxy stamps (arch 7). The CSP builder has
// its own unit test; this one pins what actually leaves the proxy, so a change in how the
// proxy calls the builder cannot quietly ship a weaker policy.

import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import nextConfig from '../../../next.config';
import { proxy } from '@/proxy';

import { SEAL_KEY } from '../server/http/step-support';

interface HeaderRule {
  readonly source: string;
  readonly headers: readonly { readonly key: string; readonly value: string }[];
}

async function fixedHeaders(): Promise<Map<string, string>> {
  if (nextConfig.headers === undefined) throw new Error('next.config.ts sets no headers');
  const rules: readonly HeaderRule[] = await nextConfig.headers();
  // One rule for every path: a header that covers only some routes is a hole in the others.
  const everywhere = rules.find((rule) => rule.source === '/:path*');
  if (everywhere === undefined) throw new Error('no header rule covers every path');
  return new Map(everywhere.headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

function directive(policy: string, name: string): string {
  const found = policy.split('; ').find((part) => part.startsWith(`${name} `));
  if (found === undefined) throw new Error(`policy has no ${name}`);
  return found;
}

describe('fixed response headers (next.config.ts)', () => {
  it('does not announce the framework', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it.each([
    ['x-content-type-options', 'nosniff'],
    ['referrer-policy', 'same-origin'],
    ['x-frame-options', 'DENY'],
    ['strict-transport-security', 'max-age=63072000; includeSubDomains'],
    ['cross-origin-opener-policy', 'same-origin'],
    ['cross-origin-resource-policy', 'same-origin'],
  ])('sends %s: %s on every path', async (name, value) => {
    expect((await fixedHeaders()).get(name)).toBe(value);
  });

  it('refuses each powerful feature it names in Permissions-Policy', async () => {
    const policy = (await fixedHeaders()).get('permissions-policy') ?? '';
    const features = policy.split(',').map((part) => part.trim());
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      expect(features).toContain(`${feature}=()`);
    }
    // An allowlist such as camera=(self) would grant the feature; only empty lists refuse.
    for (const entry of features) expect(entry).toMatch(/^[a-z-]+=\(\)$/);
  });
});

describe('Content-Security-Policy as the proxy sends it', () => {
  // A set key keeps the link gate off its warn-and-improvise path for a missing one.
  beforeAll(() => {
    vi.stubEnv('STATE_SEAL_KEY', SEAL_KEY.toString('base64'));
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });
  const start = () => proxy(new NextRequest('http://localhost/en'));
  const policyOf = (response: Response) => response.headers.get('content-security-policy') ?? '';

  it('lets scripts run only by nonce, never inline or through eval', () => {
    const policy = policyOf(start());
    const scriptSrc = directive(policy, 'script-src');
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]{16,}'/);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it('stamps the same nonce on the request the page renders from', () => {
    const response = start();
    const nonce = response.headers.get('x-middleware-request-x-nonce');
    expect(nonce).not.toBeNull();
    expect(directive(policyOf(response), 'script-src')).toContain(`'nonce-${nonce ?? ''}'`);
  });

  it.each([
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "default-src 'self'",
  ])('includes %s', (expected) => {
    expect(policyOf(start()).split('; ')).toContain(expected);
  });

  it('carries the policy on a damaged-link 404 the proxy answers itself', () => {
    const refused = proxy(new NextRequest('http://localhost/en/p/not-a-token'));
    expect(refused.status).toBe(404);
    const refusedPolicy = policyOf(refused);
    expect(directive(refusedPolicy, 'script-src')).not.toContain("'unsafe-inline'");
    expect(refusedPolicy).toContain("frame-ancestors 'none'");
  });
});
