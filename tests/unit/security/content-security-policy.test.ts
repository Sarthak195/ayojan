import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from '@/security/content-security-policy';

const NONCE = 'bm9uY2UtZm9yLXRlc3Rz';

function directive(policy: string, name: string): string | undefined {
  return policy.split('; ').find((part) => part.startsWith(`${name} `));
}

describe('buildContentSecurityPolicy', () => {
  const production = buildContentSecurityPolicy({ nonce: NONCE, isDevelopment: false });
  const development = buildContentSecurityPolicy({ nonce: NONCE, isDevelopment: true });

  it('never allows unsafe-eval in production', () => {
    expect(production).not.toContain("'unsafe-eval'");
  });

  it('adds unsafe-eval to script-src in development only', () => {
    expect(directive(development, 'script-src')).toContain("'unsafe-eval'");
  });

  it('puts the nonce and strict-dynamic in script-src', () => {
    const scriptSrc = directive(production, 'script-src');
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it('refuses to be framed', () => {
    expect(production).toContain("frame-ancestors 'none'");
    expect(development).toContain("frame-ancestors 'none'");
  });

  it('upgrades insecure requests in production but not in development', () => {
    expect(production).toContain('upgrade-insecure-requests');
    expect(development).not.toContain('upgrade-insecure-requests');
  });

  it('reflects the nonce it was given and no other', () => {
    const other = buildContentSecurityPolicy({ nonce: 'b3RoZXI=', isDevelopment: false });
    expect(other).toContain("'nonce-b3RoZXI='");
    expect(other).not.toContain(NONCE);
  });

  it.each([
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
  ])('includes %s', (expected) => {
    expect(production).toContain(expected);
  });
});
