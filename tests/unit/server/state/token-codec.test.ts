import { deflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import type { Op } from '@/schemas/plan/op';
import { seal } from '@/server/state/seal';
import { decodeState, encodeState, MAX_TOKEN_CHARACTERS } from '@/server/state/token-codec';
import { inflateBomb, smallState, typicalSessionState } from '../../../fixtures/state';

const KEY = Buffer.alloc(32, 7);
// Decryption with this key cannot succeed, so a cheap-check reason proves the costly steps
// never ran for that input.
const NO_KEY = new Uint8Array(0);

const BOOKING: Op = {
  kind: 'taskDone',
  taskId: 'book-venue',
  on: '2026-11-02',
  amountInr: 250_000,
  capacity: 300,
};

const sealedJson = (value: unknown): string =>
  seal(deflateRawSync(Buffer.from(JSON.stringify(value), 'utf8')), KEY).toString('base64url');

function encoded(state = smallState()): string {
  const result = encodeState(state, KEY);
  if (!result.ok) throw new Error(`fixture failed to encode: ${result.reason}`);
  return result.token;
}

describe('encodeState and decodeState', () => {
  it('round-trips a small state and a typical session', () => {
    for (const state of [smallState(), typicalSessionState()]) {
      expect(decodeState(encoded(state), KEY)).toEqual({ ok: true, state });
    }
  });

  it('emits only the URL-safe charset', () => {
    expect(encoded()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('refuses an empty token', () => {
    expect(decodeState('', NO_KEY)).toEqual({ ok: false, reason: 'empty' });
  });

  it('refuses 4,001 characters of valid charset before any decode', () => {
    const token = 'A'.repeat(MAX_TOKEN_CHARACTERS + 1);
    expect(decodeState(token, NO_KEY)).toEqual({ ok: false, reason: 'too-long' });
  });

  it.each(['+', '/', '=', '.', ' ', '%', 'अ'])(
    'refuses the character %j before any decode',
    (bad) => {
      const token = 'A'.repeat(MAX_TOKEN_CHARACTERS - 1) + bad;
      expect(decodeState(token, NO_KEY)).toEqual({ ok: false, reason: 'bad-charset' });
    },
  );

  it('lets exactly 4,000 characters through to decryption', () => {
    const token = 'A'.repeat(MAX_TOKEN_CHARACTERS);
    expect(decodeState(token, KEY)).toEqual({ ok: false, reason: 'tampered' });
  });

  it('refuses a token with one character changed, and a wrong key', () => {
    const token = encoded();
    const middle = Math.floor(token.length / 2);
    const swapped =
      token.slice(0, middle) + (token[middle] === 'A' ? 'B' : 'A') + token.slice(middle + 1);
    expect(decodeState(swapped, KEY)).toEqual({ ok: false, reason: 'tampered' });
    expect(decodeState(token, Buffer.alloc(32, 9))).toEqual({ ok: false, reason: 'tampered' });
  });

  it('stops an inflate bomb at the 16 KiB guard', () => {
    const token = seal(inflateBomb(), KEY).toString('base64url');
    expect(token.length).toBeLessThanOrEqual(MAX_TOKEN_CHARACTERS);
    expect(decodeState(token, KEY)).toEqual({ ok: false, reason: 'too-large' });
  });

  it('refuses authentic bytes that are not a deflate stream', () => {
    const token = seal(Buffer.from([0xff, 0xff, 0xff, 0xff]), KEY).toString('base64url');
    expect(decodeState(token, KEY)).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('refuses authentic bytes that are not JSON', () => {
    const token = seal(deflateRawSync(Buffer.from('not json', 'utf8')), KEY).toString('base64url');
    expect(decodeState(token, KEY)).toEqual({ ok: false, reason: 'invalid-json' });
  });

  it('sends a later schema version to the older-version page, not the damaged one', () => {
    expect(decodeState(sealedJson({ schema: 2, ops: [] }), KEY)).toEqual({
      ok: false,
      reason: 'unknown-version',
    });
  });

  it('refuses a payload that fails the schema, including a forged 41st op', () => {
    const fortyOne = smallState().ops.concat(Array.from({ length: 38 }, () => BOOKING));
    expect(decodeState(sealedJson({ schema: 1, ops: [{ kind: 'bogus' }] }), KEY)).toEqual({
      ok: false,
      reason: 'invalid-shape',
    });
    expect(decodeState(sealedJson({ schema: 1, ops: fortyOne }), KEY)).toEqual({
      ok: false,
      reason: 'invalid-shape',
    });
  });

  it('refuses to encode a state the decoder would refuse', () => {
    const state = smallState();
    const tooMany = { ...state, ops: Array.from({ length: 41 }, () => BOOKING) };
    expect(encodeState(tooMany, KEY)).toEqual({ ok: false, reason: 'too-many-ops' });
    const bad = {
      ...state,
      ops: [{ ...BOOKING, taskId: 'not-a-task' }],
    } as unknown as typeof state;
    expect(encodeState(bad, KEY)).toEqual({ ok: false, reason: 'invalid-shape' });
  });
});
