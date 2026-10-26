import 'server-only';

/** A bucket holds up to `capacity` requests and regains `refillPerMinute` of them a minute. */
export interface BucketPolicy {
  readonly capacity: number;
  readonly refillPerMinute: number;
}

export interface BucketState {
  readonly tokens: number;
  readonly updatedMs: number;
}

export type BucketPeek =
  | { readonly allowed: true; readonly next: BucketState }
  | { readonly allowed: false; readonly retryAfterMs: number };

const MS_PER_MINUTE = 60_000;

function refilled(state: BucketState, policy: BucketPolicy, nowMs: number): BucketState {
  // A clock that steps backwards gains nothing rather than draining the bucket.
  const elapsed = Math.max(0, nowMs - state.updatedMs);
  const tokens = Math.min(
    policy.capacity,
    state.tokens + (elapsed * policy.refillPerMinute) / MS_PER_MINUTE,
  );
  return { tokens, updatedMs: Math.max(nowMs, state.updatedMs) };
}

/** Whether one request fits now, and the state after it, without spending anything yet. */
export function peekBucket(
  state: BucketState | undefined,
  policy: BucketPolicy,
  nowMs: number,
): BucketPeek {
  const current =
    state === undefined
      ? { tokens: policy.capacity, updatedMs: nowMs }
      : refilled(state, policy, nowMs);
  if (current.tokens >= 1) {
    return { allowed: true, next: { tokens: current.tokens - 1, updatedMs: current.updatedMs } };
  }
  const missing = 1 - current.tokens;
  return {
    allowed: false,
    retryAfterMs: Math.ceil((missing * MS_PER_MINUTE) / policy.refillPerMinute),
  };
}

export interface BucketTable {
  peek(key: string, nowMs: number): BucketPeek;
  commit(key: string, next: BucketState, nowMs: number): void;
  readonly size: number;
}

/**
 * Buckets for one policy, bounded to `maxEntries` keys so a flood of distinct clients cannot
 * grow memory without limit. A full bucket behaves exactly like an absent one, so those are
 * dropped first; if every bucket is still in use, the least recently used are evicted, which
 * hands those clients a fresh bucket. That leak is accepted: it only opens under a flood the
 * per-instance daily budget still caps.
 */
export function createBucketTable(policy: BucketPolicy, maxEntries: number): BucketTable {
  const buckets = new Map<string, BucketState>();

  function prune(nowMs: number): void {
    for (const [key, state] of buckets) {
      if (refilled(state, policy, nowMs).tokens >= policy.capacity) buckets.delete(key);
    }
    // Evict down to 90 percent so a busy table does not sweep on every new client.
    const target = Math.floor(maxEntries * 0.9);
    for (const key of buckets.keys()) {
      if (buckets.size <= target) break;
      buckets.delete(key);
    }
  }

  return {
    peek: (key, nowMs) => peekBucket(buckets.get(key), policy, nowMs),
    commit(key, next, nowMs) {
      if (!buckets.has(key) && buckets.size >= maxEntries) prune(nowMs);
      // Re-inserting moves the key to the end, so Map order is least recently used first.
      buckets.delete(key);
      buckets.set(key, next);
    },
    get size() {
      return buckets.size;
    },
  };
}

export interface DailyCounter {
  count(key: string, day: string): number;
  add(key: string, day: string): void;
  readonly size: number;
}

/**
 * Counts per key for one quota day; every count resets when the day key changes. Bounded the
 * same way as the buckets, with the same accepted leak for evicted keys.
 */
export function createDailyCounter(maxEntries: number): DailyCounter {
  let currentDay = '';
  const counts = new Map<string, number>();

  function roll(day: string): void {
    if (day === currentDay) return;
    currentDay = day;
    counts.clear();
  }

  return {
    count(key, day) {
      roll(day);
      return counts.get(key) ?? 0;
    },
    add(key, day) {
      roll(day);
      const previous = counts.get(key) ?? 0;
      if (previous === 0 && counts.size >= maxEntries) {
        const oldest = counts.keys().next();
        if (oldest.done !== true) counts.delete(oldest.value);
      }
      counts.delete(key);
      counts.set(key, previous + 1);
    },
    get size() {
      return counts.size;
    },
  };
}
