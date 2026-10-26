import 'server-only';

import { createHash } from 'node:crypto';

import { HOUR_MS } from './exhaustion';

/** Every input that changes the answer; leaving one out would serve a stale reading. */
export interface ReadingCacheInputs {
  readonly promptId: string;
  readonly promptVersion: number;
  readonly schemaVersion: string;
  readonly text: string;
  /** Anything else the prompt sees, such as the language and register of a family update. */
  readonly extra: readonly string[];
}

/**
 * The inputs are hashed as a JSON array, not concatenated, so "ab" + "c" and "a" + "bc" can
 * never share a key.
 */
export function readingCacheKey(inputs: ReadingCacheInputs): string {
  const parts = [
    inputs.promptId,
    inputs.promptVersion,
    inputs.schemaVersion,
    inputs.text,
    ...inputs.extra,
  ];
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/**
 * A refusal (a reply that passed the schema but failed the caller's own check) is cached as
 * well: asking again would spend a call to get the same failing answer.
 */
export type CachedReading =
  | { readonly kind: 'reading'; readonly json: string; readonly answeredBy: string }
  | { readonly kind: 'refused'; readonly reason: string; readonly answeredBy: string };

export interface CacheBounds {
  readonly maxEntries: number;
  readonly maxBytes: number;
  readonly maxAgeMs: number;
}

/** NFR-EFF-6: 200 entries, 2 MiB of JSON, 24 hours. */
export const DEFAULT_CACHE_BOUNDS: CacheBounds = {
  maxEntries: 200,
  maxBytes: 2 * 1024 * 1024,
  maxAgeMs: 24 * HOUR_MS,
};

export interface CacheStats {
  readonly entries: number;
  readonly bytes: number;
}

export interface ReadingCache {
  get(key: string, nowMs: number): CachedReading | undefined;
  set(key: string, entry: CachedReading, nowMs: number): void;
  delete(key: string): void;
  stats(nowMs: number): CacheStats;
}

interface Stored {
  readonly entry: CachedReading;
  readonly storedAt: number;
  readonly bytes: number;
}

function sizeOf(entry: CachedReading): number {
  const body = entry.kind === 'reading' ? entry.json : entry.reason;
  return Buffer.byteLength(body) + Buffer.byteLength(entry.answeredBy);
}

/**
 * A Map keeps insertion order, so the first entry is always the least recently used: a hit is
 * moved to the end, and eviction takes from the front. No single-flight (D06): two identical
 * reads at the same moment may each spend a call, which the cache then absorbs.
 */
export function createReadingCache(bounds: CacheBounds = DEFAULT_CACHE_BOUNDS): ReadingCache {
  const stored = new Map<string, Stored>();
  let bytes = 0;

  function remove(key: string): void {
    const held = stored.get(key);
    if (held === undefined) return;
    bytes -= held.bytes;
    stored.delete(key);
  }

  function dropExpired(nowMs: number): void {
    for (const [key, held] of stored) {
      if (nowMs - held.storedAt >= bounds.maxAgeMs) remove(key);
    }
  }

  function evictOverflow(): void {
    for (const key of stored.keys()) {
      if (stored.size <= bounds.maxEntries && bytes <= bounds.maxBytes) return;
      remove(key);
    }
  }

  return {
    get(key, nowMs) {
      dropExpired(nowMs);
      const held = stored.get(key);
      if (held === undefined) return undefined;
      stored.delete(key);
      stored.set(key, held);
      return held.entry;
    },
    set(key, entry, nowMs) {
      remove(key);
      const size = sizeOf(entry);
      if (size > bounds.maxBytes) return;
      dropExpired(nowMs);
      stored.set(key, { entry, storedAt: nowMs, bytes: size });
      bytes += size;
      evictOverflow();
    },
    delete: remove,
    stats(nowMs) {
      dropExpired(nowMs);
      return { entries: stored.size, bytes };
    },
  };
}

const HOLDER = Symbol.for('ayojan.readingCache');
type CacheHolder = typeof globalThis & { [HOLDER]?: ReadingCache };

/** One cache per process, on globalThis because each Next route is bundled separately. */
export function readingCache(): ReadingCache {
  const holder: CacheHolder = globalThis;
  const held = holder[HOLDER] ?? createReadingCache();
  holder[HOLDER] = held;
  return held;
}
