import 'server-only';

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sorted(Reflect.get(value, key))]),
    );
  }
  return value;
}

/**
 * JSON with every object's keys in sorted order. The family-update cache key hashes the facts,
 * and the GET of the messages page rebuilds them later (D08): key order must not depend on
 * which code path assembled the object, or the draft would never be found again.
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(sorted(value));
}
