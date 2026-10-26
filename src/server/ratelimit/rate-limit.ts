import 'server-only';

import { INSTANCE_DAILY_ACTIONS } from '../genai/exhaustion';
import { quotaDayKey, secondsUntilNextQuotaDay, systemNow, type Now } from '../config/clock';
import {
  createBucketTable,
  createDailyCounter,
  type BucketPolicy,
  type BucketTable,
  type DailyCounter,
} from './token-bucket';

// Every count here lives in one instance's memory. With up to three Cloud Run instances the
// bounds are approximate (a client may get up to three times as much), and the client key
// comes from a caller-supplied header (see client-key.ts). These limits keep one script from
// draining the shared Gemini pool on one instance; `--max-instances=3` times the instance
// budget is the real ceiling on model calls a day.

/** `model` is read/* and messages (each may spend a model call); `step` is every other POST. */
export type RateClass = 'model' | 'step';

export type RateRefusal = 'minute' | 'client-day' | 'instance-day';

export type RateDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: RateRefusal;
      /** Whole seconds, at least one: the `Retry-After` header and the wait shown on the page. */
      readonly retryAfterSeconds: number;
    };

export interface RateLimits {
  readonly model: BucketPolicy;
  readonly step: BucketPolicy;
  readonly clientDailyModelActions: number;
  readonly instanceDailyModelActions: number;
  /** Bound on distinct clients remembered per table (NFR-EFF-6). */
  readonly maxTrackedClients: number;
}

export const DEFAULT_LIMITS: RateLimits = {
  // Six reads a minute with a burst of three (NFR-SEC-9): a person pasting a brief and two
  // quotes never waits, a script does.
  model: { capacity: 3, refillPerMinute: 6 },
  step: { capacity: 60, refillPerMinute: 60 },
  clientDailyModelActions: 20,
  // One budget shared with the gateway (see INSTANCE_DAILY_ACTIONS). A read can fall down the
  // ladder and spend more than one call, so it bounds actions, not calls; the gateway's per
  // (model, key) counters and the 80 percent reserve (D18) do the call-level accounting.
  instanceDailyModelActions: INSTANCE_DAILY_ACTIONS,
  maxTrackedClients: 10_000,
};

export interface RateLimiter {
  /**
   * Checks and, when allowed, spends one request for this client. Call it before reading the
   * body, so a refused request costs no parsing. A model action is counted here, at the
   * door, even if the body later turns out malformed or the reading comes from the cache: an
   * overcount errs on the side of protecting the pool.
   */
  check(rateClass: RateClass, clientKey: string): RateDecision;
}

export interface RateLimiterOptions {
  readonly now?: Now;
  readonly limits?: RateLimits;
}

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const now = options.now ?? systemNow;
  const limits = options.limits ?? DEFAULT_LIMITS;
  const buckets: Record<RateClass, BucketTable> = {
    model: createBucketTable(limits.model, limits.maxTrackedClients),
    step: createBucketTable(limits.step, limits.maxTrackedClients),
  };
  const clientDaily: DailyCounter = createDailyCounter(limits.maxTrackedClients);
  const instanceKey = 'instance';
  const instanceDaily: DailyCounter = createDailyCounter(1);

  return {
    check(rateClass, clientKey) {
      const nowMs = now();
      const clockAtCheck: Now = () => nowMs;
      const day = quotaDayKey(clockAtCheck);
      // Daily refusals win over the minute bucket: telling a client whose day is spent to
      // retry in ten seconds would be a lie.
      if (rateClass === 'model') {
        const untilTomorrow = (): number => secondsUntilNextQuotaDay(clockAtCheck);
        if (clientDaily.count(clientKey, day) >= limits.clientDailyModelActions) {
          return { allowed: false, reason: 'client-day', retryAfterSeconds: untilTomorrow() };
        }
        if (instanceDaily.count(instanceKey, day) >= limits.instanceDailyModelActions) {
          return { allowed: false, reason: 'instance-day', retryAfterSeconds: untilTomorrow() };
        }
      }
      const table = buckets[rateClass];
      const peek = table.peek(clientKey, nowMs);
      if (!peek.allowed) {
        return {
          allowed: false,
          reason: 'minute',
          retryAfterSeconds: Math.max(1, Math.ceil(peek.retryAfterMs / 1000)),
        };
      }
      // Nothing is spent until every check has passed, so a refusal costs the client nothing.
      table.commit(clientKey, peek.next, nowMs);
      if (rateClass === 'model') {
        clientDaily.add(clientKey, day);
        instanceDaily.add(instanceKey, day);
      }
      return { allowed: true };
    },
  };
}

const LIMITER_HOLDER = Symbol.for('ayojan.ratelimit');
type LimiterHolder = typeof globalThis & { [LIMITER_HOLDER]?: RateLimiter };

/**
 * The process-wide limiter. Held on globalThis because Next bundles each route separately,
 * and a module-level limiter would give every route its own counts.
 */
export function rateLimiter(): RateLimiter {
  const holder: LimiterHolder = globalThis;
  const held = holder[LIMITER_HOLDER];
  if (held !== undefined) return held;
  const created = createRateLimiter();
  holder[LIMITER_HOLDER] = created;
  return created;
}
