import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { clientKeyOf, rightmostForwardedFor } from '@/server/ratelimit/client-key';

const SALT = Buffer.alloc(32, 7);
const expected = (address: string) => createHmac('sha256', SALT).update(address).digest('hex');
const headers = (forwardedFor?: string) =>
  new Headers(forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor });

describe('rightmostForwardedFor', () => {
  it.each([
    { name: 'one address', header: '203.0.113.9', entry: '203.0.113.9' },
    {
      name: 'a forged list keeps only the last',
      header: 'evil, more, 203.0.113.9',
      entry: '203.0.113.9',
    },
    { name: 'no spaces', header: '10.0.0.1,198.51.100.4', entry: '198.51.100.4' },
    { name: 'IPv6', header: 'spoof, 2001:db8::1', entry: '2001:db8::1' },
    { name: 'padded', header: '  198.51.100.4  ', entry: '198.51.100.4' },
    // The front end always appends a value, so an empty last entry did not come from it.
    { name: 'a trailing comma', header: '198.51.100.4,', entry: null },
    { name: 'empty', header: '', entry: null },
    { name: 'absent', header: undefined, entry: null },
  ])('$name', ({ header, entry }) => {
    expect(rightmostForwardedFor(headers(header))).toBe(entry);
  });

  it('truncates an entry far longer than any address', () => {
    expect(rightmostForwardedFor(headers('x'.repeat(10_000)))).toHaveLength(100);
  });
});

describe('clientKeyOf', () => {
  it('is a keyed SHA-256 hex of the rightmost entry, never the raw address', () => {
    const key = clientKeyOf(headers('evil, 203.0.113.9'), SALT);
    expect(key).toBe(expected('203.0.113.9'));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('203.0.113.9');
  });

  it('gives a forged prefix no new bucket', () => {
    expect(clientKeyOf(headers('1.1.1.1, 203.0.113.9'), SALT)).toBe(
      clientKeyOf(headers('2.2.2.2, 203.0.113.9'), SALT),
    );
  });

  it('separates different front-end addresses', () => {
    expect(clientKeyOf(headers('203.0.113.9'), SALT)).not.toBe(
      clientKeyOf(headers('203.0.113.10'), SALT),
    );
  });

  it('puts every request without an address into one shared bucket', () => {
    expect(clientKeyOf(headers(), SALT)).toBe(clientKeyOf(headers(' , '), SALT));
  });

  it('keeps one process salt, so the same client keeps the same key', () => {
    expect(clientKeyOf(headers('203.0.113.9'))).toBe(clientKeyOf(headers('203.0.113.9')));
    expect(clientKeyOf(headers('203.0.113.9'))).not.toBe(expected('203.0.113.9'));
  });
});
