import { describe, expect, it } from 'vitest';

import { diffVersions, type DiffRow } from '@/core/plan/diff';

import { LEVERS, PLAN_DATA, SPEC_OPS, change, first, versionOf, viewOf } from './plan-fixture';

// The closed set of FR-25 that a revision pair (one change) may use.
const REVISION_CODES =
  /^(guests-changed|budget-changed|event-date-moved|reallocated|ranking-flipped|task-delayed:.+|lever-applied:.+)$/;

function reasonOf(row: DiffRow): string {
  return row.reason;
}

const v5 = versionOf(first(5));
const v6 = versionOf(first(6));
const v7 = versionOf(first(7));
const v8 = versionOf(first(8));
const changeRows = diffVersions(v5, v6, PLAN_DATA);

describe('diff of the explainer change (v5 to v6)', () => {
  it.each<[DiffRow['kind'], unknown]>([
    ['guests', { before: 200, after: 250, reason: 'guests-changed' }],
    ['budget', { before: { inr: 800_000 }, after: { inr: 750_000 }, reason: 'budget-changed' }],
    ['eventDate', { before: '2027-02-26', after: '2027-02-12', reason: 'event-date-moved' }],
    ['projected', { before: { inr: 743_000 }, after: { inr: 798_900 }, reason: 'guests-changed' }],
    ['gap', { before: { inr: -57_000 }, after: { inr: 48_900 }, reason: 'budget-changed' }],
    ['ranking', { category: 'catering', before: 'A', after: 'B', crossedAtGuests: 231 }],
    ['venueFit', { capacity: 220, before: 200, after: 250, fitsAfter: false }],
  ])('has the %s row', (kind, expected) => {
    expect(changeRows.find((row) => row.kind === kind)).toMatchObject(expected as object);
  });

  it('names the per-guest share beside a money row the guests moved', () => {
    const decor = changeRows.find((row) => row.kind === 'money' && row.category === 'decor');
    expect(decor).toMatchObject({
      perGuestSharePercent: 20,
      before: { projected: { inr: 53_000 } },
      after: { projected: { inr: 55_650 } },
      reason: 'guests-changed',
    });
  });

  it('lists task due dates, slack and status with event-date-moved', () => {
    const caterer = changeRows.find((row) => row.kind === 'task' && row.taskId === 'book-caterer');
    expect(caterer).toMatchObject({
      before: { latestFinish: '2026-11-28', slackDays: 18, status: 'onTrack' },
      after: { latestFinish: '2026-11-14', slackDays: 4, status: 'atRisk' },
      reason: 'event-date-moved',
    });
  });

  it('omits unchanged values: the booked venue, photo, music and the finished task', () => {
    const money = changeRows
      .filter((row) => row.kind === 'money')
      .map((row) => row.kind === 'money' && row.category);
    expect(money).toEqual(['catering', 'decor', 'invites']);
    expect(changeRows.some((row) => row.kind === 'task' && row.taskId === 'book-venue')).toBe(
      false,
    );
  });

  it('gives every row a reason code from the closed set', () => {
    for (const row of changeRows) expect(reasonOf(row)).toMatch(REVISION_CODES);
  });
});

describe('diff of other pairs', () => {
  it('is empty for a version against itself', () => {
    expect(diffVersions(v6, v6, PLAN_DATA)).toEqual([]);
  });

  it('shows each giver of a Move money step, with reallocated', () => {
    const rows = diffVersions(v7, v8, PLAN_DATA);
    expect(rows.find((row) => row.kind === 'reallocation')).toMatchObject({
      opIndex: 7,
      outcome: {
        target: 'photo',
        fromHeadroom: { inr: 15_600 },
        givers: [{ category: 'decor', amount: { inr: 24_400 } }],
      },
      reason: 'reallocated',
    });
    const moved = rows
      .filter((row) => row.kind === 'money')
      .map((row) => [row.kind === 'money' && row.category, row.reason]);
    expect(moved).toEqual([
      ['decor', 'reallocated'],
      ['photo', 'reallocated'],
    ]);
  });

  it('names the lever that moved a line and a task', () => {
    const rows = diffVersions(v6, v7, PLAN_DATA);
    const reasons = rows.map((row) => [
      row.kind === 'money' ? row.category : row.kind === 'task' ? row.taskId : row.kind,
      row.reason,
    ]);
    expect(reasons).toContainEqual(['invites', 'lever-applied:e-invites']);
    expect(reasons).toContainEqual(['contingency', 'lever-applied:half-contingency']);
    expect(reasons).toContainEqual(['print-invitations', 'lever-applied:e-invites']);
  });

  it('names a booking, a delay and a quote when comparing versions further apart', () => {
    const v1 = versionOf(first(1));
    const v2 = versionOf(first(2));
    expect(new Set(diffVersions(v1, v2, PLAN_DATA).map(reasonOf))).toContain(
      'task-done:book-venue',
    );
    const later = new Set(diffVersions(v2, v5, PLAN_DATA).map(reasonOf));
    expect(later).toContain('task-delayed:book-decorator');
    expect(later).toContain('quote-added:A');
  });

  it('says a budget raised by a lever was raised by the lever', () => {
    const raised = versionOf([
      ...first(6),
      { kind: 'leversApplied', leverIds: ['raise-budget'], raiseBudgetInr: 48_900 },
    ]);
    const budget = diffVersions(v6, raised, PLAN_DATA).find((row) => row.kind === 'budget');
    expect(budget?.reason).toBe('lever-applied:raise-budget');
  });
});

describe('the revision page pair (D32)', () => {
  it('compares the version before the latest change with the version it produced', () => {
    expect([
      viewOf(first(6)).revision?.beforeVersion,
      viewOf(first(6)).revision?.afterVersion,
    ]).toEqual([5, 6]);
    // After the levers the pair is still the change itself; the lever section uses the current plan.
    expect([
      viewOf(first(7)).revision?.beforeVersion,
      viewOf(first(7)).revision?.afterVersion,
    ]).toEqual([5, 6]);
    expect([
      viewOf(SPEC_OPS).revision?.beforeVersion,
      viewOf(SPEC_OPS).revision?.afterVersion,
    ]).toEqual([7, 8]);
  });

  it('has no revision before the first change', () => {
    expect(viewOf(first(5)).revision).toBeNull();
    expect(viewOf([...first(5), LEVERS]).revision).toBeNull();
  });

  it('diffs a priority-only change with no money row (the split is frozen, D09)', () => {
    const view = viewOf([
      ...first(5),
      change({ priorities: { ...v5.priorities, decor: 'standard' } }),
    ]);
    expect(view.revision?.rows).toEqual([]);
    expect(view.revision?.kept.changed.map((item) => item.key)).toEqual(['priority:decor']);
  });
});
