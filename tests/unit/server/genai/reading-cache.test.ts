import { describe, expect, it } from 'vitest';

import {
  createReadingCache,
  readingCache,
  readingCacheKey,
  type CachedReading,
  type ReadingCacheInputs,
} from '@/server/genai/reading-cache';

const BASE: ReadingCacheInputs = {
  promptId: 'brief',
  promptVersion: '1',
  schemaVersion: '1',
  text: '200 guests in Jaipur',
  extra: [],
};

const reading = (json: string): CachedReading => ({
  kind: 'reading',
  json,
  answeredBy: 'gemini-3.5-flash-lite',
});

describe('readingCacheKey', () => {
  it('is a SHA-256 hex digest and stable for the same inputs', () => {
    expect(readingCacheKey(BASE)).toMatch(/^[0-9a-f]{64}$/);
    expect(readingCacheKey({ ...BASE })).toBe(readingCacheKey(BASE));
  });

  it.each<[string, Partial<ReadingCacheInputs>]>([
    ['the prompt id', { promptId: 'quote' }],
    ['the prompt version', { promptVersion: '2' }],
    ['the schema version', { schemaVersion: '2' }],
    ['the text', { text: '201 guests in Jaipur' }],
    ['an extra input such as the language', { extra: ['hi'] }],
    ['the order of extra inputs', { extra: ['simple', 'hi'] }],
  ])('changes with %s', (_name, change) => {
    const withExtra = { ...BASE, extra: ['hi', 'simple'] };
    expect(readingCacheKey({ ...withExtra, ...change })).not.toBe(readingCacheKey(withExtra));
  });

  it('cannot collide by moving characters between inputs', () => {
    const left = readingCacheKey({ ...BASE, promptVersion: '1', schemaVersion: '12' });
    const right = readingCacheKey({ ...BASE, promptVersion: '11', schemaVersion: '2' });
    expect(left).not.toBe(right);
  });
});

describe('createReadingCache', () => {
  const bounds = { maxEntries: 3, maxBytes: 1_000, maxAgeMs: 1_000 };

  it('returns what was stored, refusals included', () => {
    const cache = createReadingCache(bounds);
    const refusal: CachedReading = { kind: 'refused', reason: 'draft-check', answeredBy: 'm' };
    cache.set('a', reading('{"x":1}'), 0);
    cache.set('b', refusal, 0);
    expect(cache.get('a', 10)).toEqual(reading('{"x":1}'));
    expect(cache.get('b', 10)).toEqual(refusal);
    expect(cache.get('missing', 10)).toBeUndefined();
  });

  it('forgets an entry once it reaches the age bound', () => {
    const cache = createReadingCache(bounds);
    cache.set('a', reading('{}'), 0);
    expect(cache.get('a', 999)).toBeDefined();
    expect(cache.get('a', 1_000)).toBeUndefined();
    expect(cache.stats(1_000)).toEqual({ entries: 0, bytes: 0 });
  });

  it('evicts the least recently used entry past the entry bound', () => {
    const cache = createReadingCache(bounds);
    for (const key of ['a', 'b', 'c']) cache.set(key, reading('{}'), 0);
    cache.get('a', 1);
    cache.set('d', reading('{}'), 2);
    expect(cache.get('b', 3)).toBeUndefined();
    expect(cache.stats(3).entries).toBe(3);
    expect(cache.get('a', 3)).toBeDefined();
  });

  it('evicts past the byte bound and refuses an entry larger than the whole bound', () => {
    const cache = createReadingCache(bounds);
    cache.set('a', reading('x'.repeat(500)), 0);
    cache.set('b', reading('y'.repeat(500)), 0);
    expect(cache.get('a', 1)).toBeUndefined();
    expect(cache.stats(1).bytes).toBeLessThanOrEqual(1_000);

    cache.set('huge', reading('z'.repeat(2_000)), 1);
    expect(cache.get('huge', 1)).toBeUndefined();
    expect(cache.get('b', 1)).toBeDefined();
  });

  it('stays at most 200 entries with the default bounds', () => {
    const cache = createReadingCache();
    for (let index = 0; index < 201; index += 1) cache.set(String(index), reading('{}'), 0);
    expect(cache.stats(0).entries).toBe(200);
    expect(cache.get('0', 0)).toBeUndefined();
  });
});

describe('readingCache', () => {
  it('is one cache per process', () => {
    expect(readingCache()).toBe(readingCache());
  });
});
