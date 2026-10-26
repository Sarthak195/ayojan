import { describe, expect, it } from 'vitest';

import { apply, MAX_QUOTES } from '@/core/plan/apply';
import type { PlanData } from '@/core/plan/plan-data';
import type { ApplyRefusal } from '@/core/plan/plan-refusal';
import type { Op } from '@/schemas/plan/op';
import type { QuoteSlot } from '@/schemas/plan/quote-record';

import {
  AI_READ,
  BRIEF_OP,
  CATERER_A,
  DECORATOR_DELAYED,
  EXPLAINER_CHANGE,
  LEVERS,
  PLAN_DATA,
  QUOTE_A,
  VENUE_BOOKED,
  change,
  first,
  inputsOf,
  versionOf,
} from './plan-fixture';

function refusalOf(ops: readonly Op[], op: Op, data: PlanData = PLAN_DATA): ApplyRefusal | null {
  const base = ops.length === 0 ? null : inputsOf(ops, data);
  const result = apply(base, op, data);
  if (result.ok) return null;
  return result.refusal.kind === 'apply' ? result.refusal.reason : null;
}

function quoteIn(slot: QuoteSlot): Op {
  return { kind: 'quoteAdded', quote: { ...CATERER_A, id: slot }, readBy: AI_READ };
}

describe('apply: every op kind on a known plan', () => {
  it.each<[string, readonly Op[], Op]>([
    ['starts a plan from the brief', [], BRIEF_OP],
    ['adds a quote', first(1), QUOTE_A],
    ['marks a task done with an amount', first(1), VENUE_BOOKED],
    ['records a delay as a date', first(2), DECORATOR_DELAYED],
    ['confirms a change', first(5), EXPLAINER_CHANGE],
    ['applies levers', first(6), LEVERS],
  ])('%s', (_name, ops, op) => {
    const base = ops.length === 0 ? null : inputsOf(ops);
    const result = apply(base, op, PLAN_DATA);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.ops).toHaveLength(ops.length + 1);
  });
});

describe('apply: refusals', () => {
  const choreographerDone: Op = {
    kind: 'taskDone',
    taskId: 'book-choreographer',
    on: '2026-10-31',
    amountInr: null,
    capacity: null,
  };
  const withoutChoreographer: PlanData = {
    ...PLAN_DATA,
    tasks: {
      ...PLAN_DATA.tasks,
      tasks: PLAN_DATA.tasks.tasks.filter((row) => row.id !== 'book-choreographer'),
    },
  };

  it.each<[string, readonly Op[], Op, ApplyRefusal, PlanData?]>([
    ['a first op that is not the brief', [], QUOTE_A, 'no-brief'],
    ['a second brief', first(1), BRIEF_OP, 'brief-already-confirmed'],
    [
      'a task no template activates (no choreographer must-have)',
      first(1),
      choreographerDone,
      'inactive-task',
    ],
    [
      'a task the data does not know',
      first(1),
      choreographerDone,
      'unknown-task',
      withoutChoreographer,
    ],
    [
      'a delay on a finished task',
      first(2),
      { kind: 'taskDelayed', taskId: 'book-venue', notBefore: '2026-11-10' },
      'task-already-done',
    ],
    [
      'an amount on a task that books nothing',
      first(1),
      { ...choreographerDone, taskId: 'decor-sign-off', amountInr: 5_000 },
      'amount-on-task-without-booking',
    ],
    [
      'a capacity on a task that is not the venue',
      first(1),
      { ...choreographerDone, taskId: 'book-caterer', capacity: 200 },
      'capacity-on-task-without-venue',
    ],
    ['a change with every field empty', first(1), change(), 'empty-change'],
    [
      'a change to a budget under Rs 5,000',
      first(1),
      change({ budgetInr: 4_999 }),
      'budget-out-of-range',
    ],
    [
      'a change to more than 5,000 guests',
      first(1),
      change({ guests: 5_001 }),
      'guests-out-of-range',
    ],
    [
      'a lever that clashes with a must-have (band and dhol)',
      first(1),
      { kind: 'leversApplied', leverIds: ['smaller-band'], raiseBudgetInr: null },
      'lever-disabled',
    ],
    [
      'an empty lever choice',
      first(1),
      { kind: 'leversApplied', leverIds: [], raiseBudgetInr: null },
      'no-levers',
    ],
    [
      'a raise with no amount',
      first(1),
      { kind: 'leversApplied', leverIds: ['raise-budget'], raiseBudgetInr: null },
      'raise-without-amount',
    ],
    [
      'an amount with no raise',
      first(1),
      { kind: 'leversApplied', leverIds: ['e-invites'], raiseBudgetInr: 10_000 },
      'amount-without-raise',
    ],
    ['a second quote in a used slot', first(4), QUOTE_A, 'quote-slot-taken'],
  ])('refuses %s', (_name, ops, op, reason, data) => {
    expect(refusalOf(ops, op, data)).toBe(reason);
  });

  it(`refuses a seventh quote once all ${String(MAX_QUOTES)} slots are used`, () => {
    const six = (['A', 'B', 'C', 'D', 'E', 'F'] as const).map(quoteIn);
    expect(refusalOf([BRIEF_OP, ...six], quoteIn('A'))).toBe('quote-limit');
  });

  it('refuses the 41st op and names its index', () => {
    const forty = [BRIEF_OP, ...Array.from({ length: 39 }, () => VENUE_BOOKED)];
    const result = apply(inputsOf(forty), VENUE_BOOKED, PLAN_DATA);
    expect(result).toEqual({
      ok: false,
      refusal: { kind: 'apply', reason: 'op-cap', opIndex: 40 },
    });
  });
});

describe('apply: the one booking path (D10)', () => {
  it('books the venue at the amount and lets its capacity override the brief', () => {
    const version = versionOf(first(2));
    expect(version.bookings).toEqual([
      { taskId: 'book-venue', category: 'venue', amountInr: 180_000, capacity: 220 },
    ]);
    expect(version.headline.venue).toEqual({ capacity: 220, source: 'booking' });
  });

  it('keeps the later mark when a task is marked done twice', () => {
    const again: Op = { ...VENUE_BOOKED, on: '2026-11-02', amountInr: 175_000 };
    const version = versionOf([...first(2), again]);
    expect(version.bookings[0]?.amountInr).toBe(175_000);
    expect(inputsOf([...first(2), again]).ops).toHaveLength(3);
  });

  it('marks a task done without an amount and leaves the category projected', () => {
    const version = versionOf([...first(1), { ...VENUE_BOOKED, amountInr: null, capacity: null }]);
    expect(version.bookings).toEqual([]);
    expect(version.money.projection.lines.venue.source).toBe('allocation');
  });

  it('treats a booked amount of 0 as the family number, not as unset', () => {
    const version = versionOf([...first(1), { ...VENUE_BOOKED, amountInr: 0 }]);
    expect(version.money.projection.lines.venue.projected).toEqual({
      inr: 0,
      provenance: 'your-number',
    });
  });
});

describe('apply never mutates its input', () => {
  it('leaves the earlier plan exactly as it was', () => {
    const before = inputsOf(first(5));
    const snapshot = structuredClone({ ...before, selection: null });
    const after = apply(before, EXPLAINER_CHANGE, PLAN_DATA);
    expect(after.ok).toBe(true);
    expect({ ...before, selection: null }).toStrictEqual(snapshot);
    expect(before.ops).toHaveLength(5);
  });
});
