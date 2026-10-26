import 'server-only';

export interface KeyPool {
  readonly keys: readonly string[];
  readonly count: number;
}

type Environment = Readonly<Record<string, string | undefined>>;

const EXTRA_KEY_PREFIX = 'GEMINI_API_KEY_';

/**
 * Read on every call rather than at module load, so `next build` needs no credentials, and
 * not cached, because route handlers are bundled separately and a module-level cache would
 * silently exist more than once.
 *
 * No format check on purpose: AI Studio keys now start with "AQ." and a prefix test written
 * for "AIza" would reject working keys. A wrong key surfaces as a 401 from the API instead.
 * The keys are returned to callers but never logged or placed in an error message.
 */
export function loadKeyPool(env: Environment = process.env): KeyPool {
  const extraNames = Object.keys(env)
    .filter((name) => name.startsWith(EXTRA_KEY_PREFIX))
    .sort();
  const raw = ['GEMINI_API_KEY', ...extraNames].map((name) => env[name] ?? '');

  const keys = [...new Set(raw.flatMap((value) => value.split(/[\s,]+/)).filter(Boolean))];
  return { keys, count: keys.length };
}
