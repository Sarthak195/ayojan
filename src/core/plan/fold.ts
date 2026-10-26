// The plan is a fold of its confirmed ops (architecture 4.3, 6.1): plan(N) is the first N ops
// applied in order, so Undo is "drop the last op" and a what-if is "fold one op more without
// keeping it". Nothing here reads the clock; plan-view takes `today` when it computes numbers.

import { MAX_OPS, type Op } from '@/schemas/plan/op';

import { apply } from './apply';
import type { PlanData } from './plan-data';
import type { PlanInputs } from './plan-inputs';
import { applyFail, type PlanResult } from './plan-refusal';

/** Applies every op in ledger order; the first refusal stops the fold and names its op. */
export function fold(ops: readonly Op[], data: PlanData): PlanResult<PlanInputs> {
  if (ops.length === 0) return applyFail('no-brief', 0);
  if (ops.length > MAX_OPS) return applyFail('op-cap', MAX_OPS);
  let inputs: PlanInputs | null = null;
  for (const op of ops) {
    const next: PlanResult<PlanInputs> = apply(inputs, op, data);
    if (!next.ok) return next;
    inputs = next.value;
  }
  return inputs === null ? applyFail('no-brief', 0) : { ok: true, value: inputs };
}

export type UndoResult =
  | { readonly ok: true; readonly ops: readonly Op[] }
  | { readonly ok: false; readonly reason: 'nothing-to-undo' };

/** Drops the last op. The brief stays: a plan without it has nothing to fold from (FR-29). */
export function undo(ops: readonly Op[]): UndoResult {
  if (ops.length <= 1) return { ok: false, reason: 'nothing-to-undo' };
  return { ok: true, ops: ops.slice(0, -1) };
}

/**
 * The plan with one more op, for the lever Recalculate preview. The caller's ops are not
 * touched, so a refused or abandoned preview leaves the committed plan exactly as it was.
 */
export function previewInputs(
  ops: readonly Op[],
  candidate: Op,
  data: PlanData,
): PlanResult<PlanInputs> {
  return fold([...ops, candidate], data);
}
