import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIMITS,
  createRateLimiter,
  rateLimiter,
  type RateLimits,
} from '@/server/ratelimit/rate-limit';

// 10:00 IST on Monday 26 October 2026, which is 21:30 Pacific on the 25th: the quota day
// turns at 07:00 UTC, 2.5 hours later.
const START = Date.parse('2026-10-26T04:30:00Z');
const UNTIL_QUOTA_DAY = 2.5 * 3600;

function clockAt(startMs: number) {
  let nowMs = startMs;
  return {
    now: () => nowMs,
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

describe('createRateLimiter, model actions', () => {
  it('allows a burst of 3, then refuses with the wait for the next token', () => {
    const limiter = createRateLimiter({ now: clockAt(START).now });
    expect([1, 2, 3].map(() => limiter.check('model', 'a').allowed)).toEqual([true, true, true]);
    expect(limiter.check('model', 'a')).toEqual({
      allowed: false,
      reason: 'minute',
      retryAfterSeconds: 10,
    });
  });

  it('refills six a minute on the injected clock', () => {
    const clock = clockAt(START);
    const limiter = createRateLimiter({ now: clock.now });
    [1, 2, 3].forEach(() => limiter.check('model', 'a'));
    clock.advance(4_000);
    expect(limiter.check('model', 'a')).toMatchObject({ allowed: false, retryAfterSeconds: 6 });
    clock.advance(6_000);
    expect(limiter.check('model', 'a').allowed).toBe(true);
  });

  it('caps a client at 20 a day and points the wait at the next quota day', () => {
    const clock = clockAt(START);
    const limiter = createRateLimiter({ now: clock.now });
    for (let read = 0; read < 20; read += 1) {
      expect(limiter.check('model', 'a').allowed).toBe(true);
      clock.advance(10_000);
    }
    expect(limiter.check('model', 'a')).toEqual({
      allowed: false,
      reason: 'client-day',
      retryAfterSeconds: UNTIL_QUOTA_DAY - 200,
    });
    expect(limiter.check('model', 'b').allowed).toBe(true);
    clock.advance((UNTIL_QUOTA_DAY - 200) * 1000);
    expect(limiter.check('model', 'a').allowed).toBe(true);
  });

  it('stops the whole instance at its daily budget, whoever asks', () => {
    const limits: RateLimits = { ...DEFAULT_LIMITS, instanceDailyModelActions: 5 };
    const limiter = createRateLimiter({ now: clockAt(START).now, limits });
    for (let client = 0; client < 5; client += 1) {
      expect(limiter.check('model', `c${String(client)}`).allowed).toBe(true);
    }
    expect(limiter.check('model', 'fresh')).toEqual({
      allowed: false,
      reason: 'instance-day',
      retryAfterSeconds: UNTIL_QUOTA_DAY,
    });
    expect(limiter.check('step', 'fresh').allowed).toBe(true);
  });

  it('spends nothing on a refusal', () => {
    const clock = clockAt(START);
    const limits: RateLimits = { ...DEFAULT_LIMITS, clientDailyModelActions: 4 };
    const limiter = createRateLimiter({ now: clock.now, limits });
    [1, 2, 3].forEach(() => limiter.check('model', 'a'));
    // Hammering while the bucket is empty must not use up the daily allowance.
    for (let attempt = 0; attempt < 50; attempt += 1) limiter.check('model', 'a');
    clock.advance(10_000);
    expect(limiter.check('model', 'a').allowed).toBe(true);
  });
});

describe('createRateLimiter, other steps', () => {
  it('allows 60 a minute and keeps them apart from model actions', () => {
    const limiter = createRateLimiter({ now: clockAt(START).now });
    for (let step = 0; step < 60; step += 1) expect(limiter.check('step', 'a').allowed).toBe(true);
    expect(limiter.check('step', 'a')).toEqual({
      allowed: false,
      reason: 'minute',
      retryAfterSeconds: 1,
    });
    expect(limiter.check('model', 'a').allowed).toBe(true);
  });

  it('never counts steps against the daily caps', () => {
    const clock = clockAt(START);
    const limits: RateLimits = { ...DEFAULT_LIMITS, instanceDailyModelActions: 1 };
    const limiter = createRateLimiter({ now: clock.now, limits });
    for (let step = 0; step < 200; step += 1) {
      limiter.check('step', 'a');
      clock.advance(1_000);
    }
    expect(limiter.check('model', 'a').allowed).toBe(true);
  });
});

describe('rateLimiter', () => {
  it('is one limiter per process, shared by every route bundle', () => {
    expect(rateLimiter()).toBe(rateLimiter());
    const holder: Record<symbol, unknown> = globalThis;
    expect(holder[Symbol.for('ayojan.ratelimit')]).toBe(rateLimiter());
  });
});
