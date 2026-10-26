import { describe, expect, it } from 'vitest';

import { MAX_OPS, type Op } from '@/schemas/plan/op';
import type { StateToken } from '@/schemas/plan/state-token';
import { appendOp, dropLastOp } from '@/server/state/history';
import { decodeState, encodeState } from '@/server/state/token-codec';
import { smallState } from '../../../fixtures/state';

const KEY = Buffer.alloc(32, 7);
const DELAY: Op = { kind: 'taskDelayed', taskId: 'book-caterer', notBefore: '2026-12-15' };

function grownTo(count: number): StateToken {
  let state = smallState();
  while (state.ops.length < count) {
    const next = appendOp(state, DELAY);
    if (!next.ok) throw new Error(next.reason);
    state = next.state;
  }
  return state;
}

function sealed(state: StateToken): string {
  const result = encodeState(state, KEY);
  if (!result.ok) throw new Error(result.reason);
  return result.token;
}

describe('appendOp', () => {
  it('appends up to the cap without touching the original state', () => {
    const before = smallState();
    const after = appendOp(before, DELAY);
    expect(after).toEqual({ ok: true, state: { ...before, ops: [...before.ops, DELAY] } });
    expect(before.ops).toHaveLength(3);
    expect(grownTo(MAX_OPS).ops).toHaveLength(MAX_OPS);
  });

  it('refuses the 41st op and leaves the plan unchanged', () => {
    const full = grownTo(MAX_OPS);
    const snapshot = structuredClone(full);
    expect(appendOp(full, DELAY)).toEqual({ ok: false, reason: 'op-cap' });
    expect(full).toEqual(snapshot);
  });
});

describe('dropLastOp', () => {
  it('drops the last op', () => {
    const state = grownTo(5);
    expect(dropLastOp(state)).toEqual({
      ok: true,
      state: { ...state, ops: state.ops.slice(0, 4) },
    });
  });

  it('never drops the brief', () => {
    const briefOnly = { ...smallState(), ops: smallState().ops.slice(0, 1) };
    expect(dropLastOp(briefOnly)).toEqual({ ok: false, reason: 'nothing-to-undo' });
  });

  // The IV differs on every seal, so Undo is checked on the decrypted payloads.
  it('gives back the same payload after a step and its Undo, in a different token', () => {
    const before = smallState();
    const stepped = appendOp(before, DELAY);
    if (!stepped.ok) throw new Error(stepped.reason);
    const undone = dropLastOp(stepped.state);
    if (!undone.ok) throw new Error(undone.reason);
    const first = sealed(before);
    const second = sealed(undone.state);
    expect(second).not.toBe(first);
    expect(decodeState(second, KEY)).toEqual(decodeState(first, KEY));
  });
});
