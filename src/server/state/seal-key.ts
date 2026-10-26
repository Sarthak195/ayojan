import 'server-only';

import { randomBytes } from 'node:crypto';

type Environment = Readonly<Record<string, string | undefined>>;

export const SEAL_KEY_VARIABLE = 'STATE_SEAL_KEY';
export const SEAL_KEY_BYTES = 32;

/** The error names the variable and what is wrong with it, never any part of its value. */
export class SealKeyError extends Error {
  override readonly name = 'SealKeyError';
  constructor(problem: 'missing' | 'malformed') {
    super(
      problem === 'missing'
        ? `${SEAL_KEY_VARIABLE} is not set, so plan links cannot be sealed or opened.`
        : `${SEAL_KEY_VARIABLE} must be one base64 value of ${String(SEAL_KEY_BYTES)} bytes.`,
    );
  }
}

const EPHEMERAL = Symbol.for('ayojan.state.ephemeral-seal-key');
type EphemeralHolder = Record<typeof EPHEMERAL, Buffer | undefined>;

// Memoised on globalThis, not in a module variable, because route handlers are bundled
// separately: a per-module key would make a link sealed by one route unreadable by another.
function ephemeralKey(): Buffer {
  const holder = globalThis as unknown as EphemeralHolder;
  const existing = holder[EPHEMERAL];
  if (existing) return existing;
  const key = randomBytes(SEAL_KEY_BYTES);
  holder[EPHEMERAL] = key;
  process.emitWarning(
    `${SEAL_KEY_VARIABLE} is not set; using a key for this process only, so plan links stop working on restart.`,
    'SealKeyWarning',
  );
  return key;
}

/**
 * Read on every call rather than at module load, so `next build` needs no secret. Production
 * refuses to run without the key: an ephemeral key there would silently break every shared
 * link on the next cold start.
 */
export function loadSealKey(env: Environment = process.env): Buffer {
  const raw = env[SEAL_KEY_VARIABLE]?.trim() ?? '';
  if (raw === '') {
    if (env.NODE_ENV === 'production') throw new SealKeyError('missing');
    return ephemeralKey();
  }
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(raw)) throw new SealKeyError('malformed');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== SEAL_KEY_BYTES) throw new SealKeyError('malformed');
  return key;
}
