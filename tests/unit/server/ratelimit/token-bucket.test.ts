import { describe, expect, it } from 'vitest';

import {
  createBucketTable,
  createDailyCounter,
  peekBucket,
  type BucketPolicy,
} from '@/server/ratelimit/token-bucket';

const READS: BucketPolicy = { capacity: 3, refillPerMinute: 6 };

function spend(table: ReturnType<typeof createBucketTable>, key: string, nowMs: number) {
  const peek = table.peek(key, nowMs);
  if (peek.allowed) table.commit(key, peek.next, nowMs);
  return peek;
}

describe('peekBucket', () => {
  it('starts a new client full', () => {
    const peek = peekBucket(undefined, READS, 0);
    expect(peek).toEqual({ allowed: true, next: { tokens: 2, updatedMs: 0 } });
  });

  it.each([
    {
      name: 'empty, no time passed',
      tokens: 0,
      elapsedMs: 0,
      allowed: false,
      retryAfterMs: 10_000,
    },
    { name: 'empty, 4 s passed', tokens: 0, elapsedMs: 4_000, allowed: false, retryAfterMs: 6_000 },
    { name: 'empty, 10 s passed', tokens: 0, elapsedMs: 10_000, allowed: true, retryAfterMs: null },
    {
      name: 'half a token, 5 s passed',
      tokens: 0.5,
      elapsedMs: 5_000,
      allowed: true,
      retryAfterMs: null,
    },
  ])('$name', ({ tokens, elapsedMs, allowed, retryAfterMs }) => {
    const peek = peekBucket({ tokens, updatedMs: 1_000 }, READS, 1_000 + elapsedMs);
    expect(peek.allowed).toBe(allowed);
    if (!peek.allowed) expect(peek.retryAfterMs).toBe(retryAfterMs);
  });

  it('never refills past capacity', () => {
    const peek = peekBucket({ tokens: 0, updatedMs: 0 }, READS, 3_600_000);
    expect(peek).toEqual({ allowed: true, next: { tokens: 2, updatedMs: 3_600_000 } });
  });

  it('gains nothing from a clock that steps backwards', () => {
    expect(peekBucket({ tokens: 0, updatedMs: 50_000 }, READS, 0).allowed).toBe(false);
  });
});

describe('createBucketTable', () => {
  it('allows the burst, refuses the next, and refills on the injected clock', () => {
    const table = createBucketTable(READS, 100);
    expect([0, 0, 0].map((t) => spend(table, 'a', t).allowed)).toEqual([true, true, true]);
    expect(spend(table, 'a', 0)).toEqual({ allowed: false, retryAfterMs: 10_000 });
    expect(spend(table, 'a', 9_999).allowed).toBe(false);
    expect(spend(table, 'a', 10_000).allowed).toBe(true);
    expect(spend(table, 'a', 10_000).allowed).toBe(false);
  });

  it('keeps clients apart', () => {
    const table = createBucketTable(READS, 100);
    [0, 0, 0].forEach((t) => spend(table, 'a', t));
    expect(spend(table, 'b', 0).allowed).toBe(true);
  });

  it('stays bounded after 10,000 distinct clients', () => {
    const table = createBucketTable(READS, 1_000);
    for (let client = 0; client < 10_000; client += 1) spend(table, `client-${String(client)}`, 0);
    expect(table.size).toBeLessThanOrEqual(1_000);
  });

  it('drops refilled buckets first and keeps clients still waiting', () => {
    const table = createBucketTable(READS, 10);
    [0, 0, 0].forEach((t) => spend(table, 'busy', t));
    for (let client = 0; client < 9; client += 1) spend(table, `idle-${String(client)}`, 0);
    // By 50 s the idle clients are full again; "busy" empties its bucket once more.
    [50_000, 50_000, 50_000].forEach((t) => spend(table, 'busy', t));
    spend(table, 'newcomer', 50_000);
    expect(table.size).toBe(2);
    expect(spend(table, 'busy', 50_000).allowed).toBe(false);
  });
});

describe('createDailyCounter', () => {
  it('counts per key within a day and resets when the day changes', () => {
    const counter = createDailyCounter(10);
    counter.add('a', '2026-10-26');
    counter.add('a', '2026-10-26');
    counter.add('b', '2026-10-26');
    expect(counter.count('a', '2026-10-26')).toBe(2);
    expect(counter.count('b', '2026-10-26')).toBe(1);
    expect(counter.count('a', '2026-10-27')).toBe(0);
    expect(counter.size).toBe(0);
  });

  it('stays bounded after 10,000 distinct keys', () => {
    const counter = createDailyCounter(500);
    for (let key = 0; key < 10_000; key += 1) counter.add(`k-${String(key)}`, '2026-10-26');
    expect(counter.size).toBe(500);
  });
});
