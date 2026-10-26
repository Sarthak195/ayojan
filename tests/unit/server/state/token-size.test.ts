import { deflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { MAX_OPS } from '@/schemas/plan/op';
import { SHORT_TEXT_MAX_BYTES, utf8ByteLength } from '@/schemas/plan/short-text';
import { StateToken } from '@/schemas/plan/state-token';
import { seal } from '@/server/state/seal';
import {
  decodeState,
  encodeState,
  MAX_INFLATED_BYTES,
  MAX_TOKEN_CHARACTERS,
} from '@/server/state/token-codec';
import { specWorstState, typicalSessionState, worstCaseState } from '../../../fixtures/state';

const KEY = Buffer.alloc(32, 7);

// The length the link would have with no cap, so a refused state can still be measured.
function uncappedLength(state: StateToken): { json: number; sealed: number } {
  const json = Buffer.from(JSON.stringify(state), 'utf8');
  const sealed = seal(deflateRawSync(json, { level: 9 }), KEY).toString('base64url');
  return { json: json.length, sealed: sealed.length };
}

// Measured on 26 Oct 2026 (M2) and recorded in .planning/03 section 8 with the decision in
// D38: no op count makes the schema maximum fit in 4,000 characters, so the codec's length
// check is the guarantee and these pins catch any schema change that grows a link.
describe('worst-case token size', () => {
  it('builds states the schema accepts, with display quotes at the byte limit', () => {
    const states = [worstCaseState(), worstCaseState(MAX_OPS, 'syllables'), specWorstState()];
    for (const state of [...states, typicalSessionState()]) {
      expect(StateToken.safeParse(state).success).toBe(true);
    }
    // Whole words stop a little short of the limit; syllables fill it to within one pair.
    for (const [style, floor] of [
      ['words', 60],
      ['syllables', 75],
    ] as const) {
      const fields = worstCaseState(MAX_OPS, style).pending?.fields ?? [];
      expect(fields).toHaveLength(16);
      for (const { displayQuote } of fields) {
        const bytes = utf8ByteLength(displayQuote ?? '');
        expect(bytes).toBeGreaterThanOrEqual(floor);
        expect(bytes).toBeLessThanOrEqual(SHORT_TEXT_MAX_BYTES);
        expect(displayQuote).toMatch(/^[ऀ-ॿ 0-9]+$/);
      }
    }
  });

  it.each([
    {
      name: 'S1 schema maximum, Hindi words',
      state: () => worstCaseState(),
      json: 32_572,
      sealed: 6_196,
    },
    {
      name: 'S1 schema maximum, random syllables',
      state: () => worstCaseState(MAX_OPS, 'syllables'),
      json: 34_224,
      sealed: 10_584,
    },
    {
      name: 'S2 spec worst case, Hindi words',
      state: () => specWorstState(),
      json: 18_978,
      sealed: 4_528,
    },
    {
      name: 'S3 spec worst case, ASCII quote labels',
      state: () => specWorstState('words', true),
      json: 16_082,
      sealed: 4_254,
    },
  ])('refuses to emit $name ($sealed characters uncapped)', ({ state, json, sealed }) => {
    expect(uncappedLength(state())).toEqual({ json, sealed });
    expect(sealed).toBeGreaterThan(MAX_TOKEN_CHARACTERS);
    expect(encodeState(state(), KEY)).toEqual({ ok: false, reason: 'too-long' });
  });

  it('fits the schema maximum up to 12 ops with Hindi words, and only 3 with random syllables', () => {
    expect(uncappedLength(worstCaseState(12)).sealed).toBe(3_944);
    expect(encodeState(worstCaseState(12), KEY).ok).toBe(true);
    expect(encodeState(worstCaseState(13), KEY)).toEqual({ ok: false, reason: 'too-long' });
    expect(encodeState(worstCaseState(3, 'syllables'), KEY).ok).toBe(true);
    expect(encodeState(worstCaseState(4, 'syllables'), KEY)).toEqual({
      ok: false,
      reason: 'too-long',
    });
  });

  it('seals a typical full session (19 ops, pending change) in 2,760 characters and opens it', () => {
    const state = typicalSessionState();
    expect(state.ops).toHaveLength(19);
    expect(uncappedLength(state)).toEqual({ json: 7_283, sealed: 2_760 });
    const result = encodeState(state, KEY);
    if (!result.ok) throw new Error(result.reason);
    expect(result.token.length).toBe(2_760);
    expect(decodeState(result.token, KEY)).toEqual({ ok: true, state });
  });

  it('never emits a link whose JSON would trip the inflate guard on the way back', () => {
    expect(uncappedLength(worstCaseState(13)).json).toBeGreaterThan(MAX_INFLATED_BYTES);
    expect(uncappedLength(worstCaseState(12)).json).toBeLessThanOrEqual(MAX_INFLATED_BYTES);
  });
});
