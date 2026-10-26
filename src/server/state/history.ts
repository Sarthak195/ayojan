import 'server-only';

import { MAX_OPS, type Op } from '@/schemas/plan/op';
import type { StateToken } from '@/schemas/plan/state-token';

export type HistoryResult =
  { ok: true; state: StateToken } | { ok: false; reason: 'op-cap' | 'nothing-to-undo' };

/**
 * The 41st step is refused rather than merged into a baseline (pre-cut, D06), so the plan the
 * user sees is unchanged and the page can say why (FR-37).
 */
export function appendOp(state: StateToken, op: Op): HistoryResult {
  if (state.ops.length >= MAX_OPS) return { ok: false, reason: 'op-cap' };
  return { ok: true, state: { ...state, ops: [...state.ops, op] } };
}

/** Undo never removes the first op: a plan without its brief has nothing to fold from. */
export function dropLastOp(state: StateToken): HistoryResult {
  if (state.ops.length <= 1) return { ok: false, reason: 'nothing-to-undo' };
  return { ok: true, state: { ...state, ops: state.ops.slice(0, -1) } };
}
