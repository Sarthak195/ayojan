import 'server-only';

import { deflateRawSync, inflateRawSync } from 'node:zlib';

import { MAX_OPS } from '@/schemas/plan/op';
import { StateToken } from '@/schemas/plan/state-token';

import { isRecord } from '@/server/util/is-record';

import { open, seal } from './seal';

/** The link must survive chat apps and old browsers that truncate long URLs (spec 8). */
export const MAX_TOKEN_CHARACTERS = 4_000;

// Far above any legal state's JSON (the worst case is measured in token-size.test.ts) yet
// small enough that a forged payload cannot make the server allocate much: a deflate stream
// can expand about a thousandfold, so the cap is what makes inflating untrusted input safe.
export const MAX_INFLATED_BYTES = 16_384;

const TOKEN_CHARSET = /^[A-Za-z0-9_-]+$/;
const CURRENT_SCHEMA = 1;

export type DecodeRefusal =
  | 'empty'
  | 'too-long'
  | 'bad-charset'
  | 'tampered'
  | 'too-large'
  | 'corrupt'
  | 'invalid-json'
  | 'unknown-version'
  | 'invalid-shape';

export type DecodeResult = { ok: true; state: StateToken } | { ok: false; reason: DecodeRefusal };

export type EncodeRefusal = 'invalid-shape' | 'too-many-ops' | 'too-long';
export type EncodeResult = { ok: true; token: string } | { ok: false; reason: EncodeRefusal };

/**
 * Seals a state into the opaque path segment. A state the decoder would refuse is refused
 * here too, so the server can never hand out a link it cannot open again.
 */
export function encodeState(state: StateToken, key: Uint8Array): EncodeResult {
  if (state.ops.length > MAX_OPS) return { ok: false, reason: 'too-many-ops' };
  const parsed = StateToken.safeParse(state);
  if (!parsed.success) return { ok: false, reason: 'invalid-shape' };
  const json = Buffer.from(JSON.stringify(parsed.data), 'utf8');
  if (json.length > MAX_INFLATED_BYTES) return { ok: false, reason: 'too-long' };
  const token = seal(deflateRawSync(json, { level: 9 }), key).toString('base64url');
  if (token.length > MAX_TOKEN_CHARACTERS) return { ok: false, reason: 'too-long' };
  return { ok: true, token };
}

function inflate(compressed: Buffer): Buffer | 'too-large' | 'corrupt' {
  try {
    return inflateRawSync(compressed, { maxOutputLength: MAX_INFLATED_BYTES });
  } catch (error) {
    return error instanceof RangeError ? 'too-large' : 'corrupt';
  }
}

/**
 * Each step refuses before the next runs (arch 6.1), so the cheap checks guard the costly
 * ones: no base64 decoding of an oversized string, no inflating of unauthenticated bytes,
 * no JSON parsing past 16 KiB.
 */
export function decodeState(token: string, key: Uint8Array): DecodeResult {
  if (token.length === 0) return { ok: false, reason: 'empty' };
  if (token.length > MAX_TOKEN_CHARACTERS) return { ok: false, reason: 'too-long' };
  if (!TOKEN_CHARSET.test(token)) return { ok: false, reason: 'bad-charset' };

  const opened = open(Buffer.from(token, 'base64url'), key);
  if (!opened.ok) return { ok: false, reason: 'tampered' };

  const json = inflate(opened.plaintext);
  if (typeof json === 'string') return { ok: false, reason: json };

  let value: unknown;
  try {
    value = JSON.parse(json.toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }

  // Checked before the shape: the schema pins `schema: 1`, so a later format would otherwise
  // be reported as damaged instead of reaching the "older version" page.
  if (isRecord(value) && value.schema !== CURRENT_SCHEMA && typeof value.schema === 'number') {
    return { ok: false, reason: 'unknown-version' };
  }
  const parsed = StateToken.safeParse(value);
  if (!parsed.success) return { ok: false, reason: 'invalid-shape' };
  return { ok: true, state: parsed.data };
}
