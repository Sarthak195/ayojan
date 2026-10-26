import { describe, expect, it } from 'vitest';

import { apply } from '@/core/plan/apply';
import { fold, undo } from '@/core/plan/fold';
import type { PlanInputs } from '@/core/plan/plan-inputs';
import { previewOp } from '@/core/plan/plan-view';
import type { Op } from '@/schemas/plan/op';

import {
  BRIEF_OP,
  LEVERS,
  PLAN_DATA,
  SPEC_OPS,
  VENUE_BOOKED,
  first,
  today,
  viewOf,
} from './plan-fixture';

describe('fold', () => {
  it('equals applying the ops one by one, for every prefix of the change test', () => {
    let stepwise: PlanInputs | null = null;
    for (const [index, op] of SPEC_OPS.entries()) {
      const next = apply(stepwise, op, PLAN_DATA);
      if (!next.ok) throw new Error(JSON.stringify(next.refusal));
      stepwise = next.value;
      const folded = fold(SPEC_OPS.slice(0, index + 1), PLAN_DATA);
      expect(folded.ok && folded.value).toStrictEqual(stepwise);
    }
  });

  it('refuses an empty op list', () => {
    expect(fold([], PLAN_DATA)).toEqual({
      ok: false,
      refusal: { kind: 'apply', reason: 'no-brief', opIndex: 0 },
    });
  });

  it('refuses more than 40 ops with no baseline merge (D06)', () => {
    const ops = [BRIEF_OP, ...Array.from({ length: 40 }, () => VENUE_BOOKED)];
    expect(fold(ops, PLAN_DATA)).toEqual({
      ok: false,
      refusal: { kind: 'apply', reason: 'op-cap', opIndex: 40 },
    });
    expect(fold(ops.slice(0, 40), PLAN_DATA).ok).toBe(true);
  });

  it('names the first op that is refused', () => {
    const ops: Op[] = [BRIEF_OP, VENUE_BOOKED, BRIEF_OP, VENUE_BOOKED];
    expect(fold(ops, PLAN_DATA)).toEqual({
      ok: false,
      refusal: { kind: 'apply', reason: 'brief-already-confirmed', opIndex: 2 },
    });
  });

  it('is deterministic: the same ops give a deep-equal view', () => {
    expect(viewOf(SPEC_OPS)).toStrictEqual(viewOf([...SPEC_OPS]));
  });
});

describe('undo', () => {
  it('drops the last op and gives back the previous view exactly', () => {
    const undone = undo(SPEC_OPS);
    expect(undone.ok && undone.ops).toStrictEqual(first(7));
    if (undone.ok) expect(viewOf(undone.ops)).toStrictEqual(viewOf(first(7)));
  });

  it('refuses to remove the brief', () => {
    expect(undo([BRIEF_OP])).toEqual({ ok: false, reason: 'nothing-to-undo' });
    expect(undo([])).toEqual({ ok: false, reason: 'nothing-to-undo' });
  });
});

describe('previewOp', () => {
  it('shows the plan with one more op and leaves the input untouched', () => {
    const ops = first(6);
    const copy = structuredClone(ops);
    const preview = previewOp(ops, LEVERS, PLAN_DATA, today);
    expect(preview.ok && preview.value).toStrictEqual(viewOf(first(7)));
    expect(ops).toStrictEqual(copy);
  });

  it('reports a refused candidate without changing the plan', () => {
    const preview = previewOp(first(1), BRIEF_OP, PLAN_DATA, today);
    expect(preview.ok).toBe(false);
  });
});
