import { describe, expect, it } from 'vitest';

import type { Category, Priority } from '@/schemas/readings/vocabulary';

import type { AllocationDeltas, FrozenSplit } from '@/core/budget/frozen-split';
import type { Projection, ProjectionEvidence } from '@/core/budget/projection';
import { projectSpend } from '@/core/budget/projection';
import type { MoveMoneyOutcome } from '@/core/budget/reallocation';
import { moveMoney } from '@/core/budget/reallocation';

import { amountsOf, priorities, splitFor } from './draft-data';

interface Scene {
  readonly split: FrozenSplit;
  readonly deltas: AllocationDeltas;
  readonly guestsNow: number;
  readonly budgetNowInr: number;
  readonly evidence: ProjectionEvidence;
  readonly priorities: Record<Category, Priority>;
  readonly mustHaveCategories: readonly Category[];
}

function scene(changes: Partial<Scene> = {}): Scene {
  const split = changes.split ?? splitFor();
  return {
    split,
    deltas: {},
    guestsNow: split.guestsAtSplit,
    budgetNowInr: split.budgetAtSplit.inr,
    evidence: {},
    priorities: priorities({ catering: 'more', decor: 'save' }),
    mustHaveCategories: [],
    ...changes,
  };
}

function view(s: Scene): Projection {
  const result = projectSpend(s);
  if (!result.ok) throw new Error(`The test projection was refused: ${result.reason}`);
  return result.value;
}

function move(s: Scene, target: Category, amountInr: number): MoveMoneyOutcome {
  const result = moveMoney({
    split: s.split,
    deltas: s.deltas,
    projection: view(s),
    priorities: s.priorities,
    mustHaveCategories: s.mustHaveCategories,
    target,
    amountInr,
  });
  if (!result.ok) throw new Error(`The test move was refused: ${result.reason}`);
  return result.value;
}

const givenBy = (outcome: MoveMoneyOutcome): Partial<Record<Category, number>> =>
  Object.fromEntries(outcome.givers.map((giver) => [giver.category, giver.amount.inr]));

// The state of spec 5.2 after the levers: 250 guests, budget 7,50,000, venue booked at
// 1,80,000, caterer B quoted at 3,00,000, e-invites and half contingency applied.
function changeTestScene(overrides: Partial<Scene> = {}): Scene {
  return scene({
    guestsNow: 250,
    budgetNowInr: 750_000,
    priorities: priorities({ catering: 'standard', decor: 'save' }),
    mustHaveCategories: ['music'],
    evidence: {
      venue: { bookedInr: 180_000 },
      catering: { quote: { totalInr: 300_000, plusGstRateNotStated: false } },
      invites: { lever: { projectedInr: 39_750, exact: false } },
      contingency: { lever: { projectedInr: 38_000, exact: true } },
    },
    ...overrides,
  });
}

describe('moveMoney on the change test of spec 5.2', () => {
  it('moves Rs 40,000 to photo from headroom first and then from decor alone', () => {
    const s = changeTestScene();
    expect(view(s).headroom.inr).toBe(15_600);
    const outcome = move(s, 'photo', 40_000);
    expect(outcome.fromHeadroom.inr).toBe(15_600);
    expect(givenBy(outcome)).toEqual({ decor: 24_400 });
    expect(outcome.givers[0]?.reason).toBe('save-tier');
    expect(outcome.shortfall.inr).toBe(0);
    expect(outcome.deltas).toEqual({ photo: 40_000, decor: -24_400 });
  });

  it('takes decor from 53,000 to 28,600 and projects just under budget at Rs 7,48,780', () => {
    const s = changeTestScene();
    const outcome = move(s, 'photo', 40_000);
    const after = view({ ...s, deltas: outcome.deltas });
    expect(after.lines.decor.allocation.inr).toBe(28_600);
    // Hand-pinned from spec 5.2 step 5: 180,000 + 300,000 + 30,030 + 116,000 + 45,000 + 39,750 + 38,000.
    expect(after.projectedTotal.inr).toBe(748_780);
    expect(after.status).toBe('within-budget');
  });

  it('refuses every other category as a giver and says why', () => {
    const outcome = move(changeTestScene(), 'photo', 40_000);
    const reasons = Object.fromEntries(outcome.skipped.map((s) => [s.category, s.reason]));
    expect(reasons).toEqual({
      venue: 'booked',
      catering: 'quoted',
      photo: 'target',
      music: 'must-have',
      invites: 'levered',
      contingency: 'levered',
    });
  });

  it('shows the Hinglish Rs 50,000 shortfall as over budget and cuts nothing below a floor', () => {
    const s = changeTestScene();
    const outcome = move(s, 'photo', 50_000);
    // Headroom 15,600, then decor down to its floor of 26,500 (53,000 x 50 percent).
    expect(givenBy(outcome)).toEqual({ decor: 26_500 });
    expect(outcome.shortfall.inr).toBe(7_900);
    const after = view({ ...s, deltas: outcome.deltas });
    expect(after.lines.decor.allocation.inr).toBe(26_500);
    expect(after.lines.photo.allocation.inr).toBe(126_000);
    // Hand-pinned: 180,000 + 300,000 + 27,825 + 126,000 + 45,000 + 39,750 + 38,000 = 756,575.
    expect(after.gap.inr).toBe(6_575);
    expect(after.status).toBe('over-budget');
  });
});

describe('moveMoney draws in the order of D12', () => {
  it('covers a move that fits in headroom without any giver', () => {
    const s = scene({ budgetNowInr: 900_000 });
    const outcome = move(s, 'photo', 60_000);
    expect(outcome.givers).toEqual([]);
    expect(outcome.fromHeadroom.inr).toBe(60_000);
    expect(outcome.shortfall.inr).toBe(0);
    expect(outcome.deltas).toEqual({ photo: 60_000 });
  });

  it('takes the save tier first, then standard categories in data order', () => {
    // No headroom: 8 lakh, decor save, food invest-more. Hand-worked from the demo split:
    // decor gives its 26,500, then photo 38,000, music 22,500, invites 13,000 (data order);
    // contingency (36,000 above its 5 percent floor) is not reached.
    const outcome = move(scene(), 'venue', 100_000);
    expect(outcome.givers.map((giver) => [giver.category, giver.amount.inr, giver.reason])).toEqual(
      [
        ['decor', 26_500, 'save-tier'],
        ['photo', 38_000, 'standard-tier'],
        ['music', 22_500, 'standard-tier'],
        ['invites', 13_000, 'standard-tier'],
      ],
    );
    expect(outcome.shortfall.inr).toBe(0);
  });

  it('takes from a save category that comes later in data order before an earlier standard one', () => {
    const s = scene({ priorities: priorities({ contingency: 'save' }) });
    const outcome = move(s, 'photo', 10_000);
    expect(givenBy(outcome)).toEqual({ contingency: 10_000 });
  });

  it('counts an unclear priority as standard, after the save tier', () => {
    const s = scene({
      priorities: priorities({ catering: 'more', decor: 'save', venue: 'unclear' }),
    });
    const outcome = move(s, 'photo', 30_000);
    expect(outcome.givers.map((giver) => giver.category)).toEqual(['decor', 'venue']);
    expect(outcome.givers[1]?.reason).toBe('standard-tier');
  });

  it('stops each giver at half of its frozen allocation', () => {
    const s = scene();
    const outcome = move(s, 'venue', 100_000);
    const frozen = amountsOf(s.split);
    for (const giver of outcome.givers) {
      expect(giver.amount.inr).toBeLessThanOrEqual(frozen[giver.category] / 2);
    }
  });

  it('stops contingency at 5 percent of the current budget, not of its own allocation', () => {
    const s = scene({ priorities: priorities({ catering: 'more' }) });
    const outcome = move(s, 'venue', 800_000);
    // 76,000 allocation less the 40,000 floor (5 percent of 8 lakh).
    expect(givenBy(outcome).contingency).toBe(36_000);
    const lower = scene({
      priorities: priorities({ catering: 'more' }),
      budgetNowInr: 600_000,
    });
    // At a budget of 6 lakh the floor is 30,000, so contingency can give 46,000.
    expect(givenBy(move(lower, 'venue', 800_000)).contingency).toBe(46_000);
  });

  it('builds on an earlier move: a giver already part-drained gives only what is left', () => {
    const first = move(scene(), 'photo', 20_000);
    expect(givenBy(first)).toEqual({ decor: 20_000 });
    const s = scene({ deltas: first.deltas });
    const second = move(s, 'photo', 20_000);
    // Decor had 53,000 - 20,000 = 33,000 left, floor 26,500, so 6,500 is all it can give.
    expect(givenBy(second).decor).toBe(6_500);
    expect(second.deltas.photo).toBe(40_000);
    expect(second.deltas.decor).toBe(-26_500);
  });
});

describe('moveMoney never takes from a protected category', () => {
  const protections: [
    string,
    Partial<Scene>,
    'booked' | 'quoted' | 'levered' | 'must-have' | 'invest-more',
  ][] = [
    ['a booked category', { evidence: { decor: { bookedInr: 50_000 } } }, 'booked'],
    [
      'a quoted category',
      { evidence: { decor: { quote: { totalInr: 50_000, plusGstRateNotStated: false } } } },
      'quoted',
    ],
    [
      'a category an applied lever touches',
      { evidence: { decor: { lever: { projectedInr: 40_000, exact: false } } } },
      'levered',
    ],
    ['a category tied to a must-have', { mustHaveCategories: ['decor'] }, 'must-have'],
    [
      'an invest-more category',
      { priorities: priorities({ catering: 'more', decor: 'more' }) },
      'invest-more',
    ],
  ];

  it.each(protections)(
    'skips %s and takes from the standard tier instead',
    (_name, changes, why) => {
      const outcome = move(scene(changes), 'venue', 20_000);
      expect(givenBy(outcome).decor).toBeUndefined();
      expect(outcome.skipped).toContainEqual({ category: 'decor', reason: why });
      // A booking, quote or lever below the allocation frees headroom, which is spent first.
      expect(givenBy(outcome)).toEqual({ photo: 20_000 - outcome.fromHeadroom.inr });
    },
  );

  it('never gives from the target, even when it is a save category with room to give', () => {
    const outcome = move(scene(), 'decor', 100_000);
    expect(givenBy(outcome).decor).toBeUndefined();
    expect(outcome.skipped).toContainEqual({ category: 'decor', reason: 'target' });
  });

  it('reports a category already at its floor as at-floor', () => {
    const first = move(scene(), 'photo', 26_500);
    const outcome = move(scene({ deltas: first.deltas }), 'photo', 1_000);
    expect(outcome.skipped).toContainEqual({ category: 'decor', reason: 'at-floor' });
  });
});

describe('moveMoney when the request is larger than anyone can give', () => {
  it('returns the exact remainder as the shortfall and keeps every floor', () => {
    const s = scene();
    const outcome = move(s, 'venue', 700_000);
    // Hand-worked: decor 26,500 + photo 38,000 + music 22,500 + invites 26,500 + contingency 36,000.
    expect(outcome.givers.reduce((sum, giver) => sum + giver.amount.inr, 0)).toBe(149_500);
    expect(outcome.shortfall.inr).toBe(700_000 - 149_500);
    const after = view({ ...s, deltas: outcome.deltas });
    for (const category of ['decor', 'photo', 'music', 'invites'] as const) {
      expect(after.lines[category].allocation.inr).toBeGreaterThanOrEqual(
        Math.ceil(s.split.lines[category].allocation.inr / 2),
      );
    }
    expect(after.lines.contingency.allocation.inr).toBeGreaterThanOrEqual(40_000);
    expect(after.status).toBe('over-budget');
  });

  it('gives nothing and reports the whole request when every category is protected', () => {
    const s = changeTestScene({ priorities: priorities({}, 'more') });
    const outcome = move(s, 'photo', 100_000);
    expect(outcome.givers).toEqual([]);
    expect(outcome.fromHeadroom.inr).toBe(15_600);
    expect(outcome.shortfall.inr).toBe(84_400);
  });
});

describe('moveMoney edge cases', () => {
  it('treats an amount of zero as a no-op that leaves the deltas untouched', () => {
    const first = move(scene(), 'photo', 10_000);
    const outcome = move(scene({ deltas: first.deltas }), 'music', 0);
    expect(outcome.givers).toEqual([]);
    expect(outcome.shortfall.inr).toBe(0);
    expect(outcome.deltas).toEqual(first.deltas);
  });

  it.each([
    ['negative', -1],
    ['fractional', 100.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('refuses a %s amount with a typed reason', (_name, amountInr) => {
    const s = scene();
    expect(
      moveMoney({
        split: s.split,
        deltas: s.deltas,
        projection: view(s),
        priorities: s.priorities,
        mustHaveCategories: s.mustHaveCategories,
        target: 'photo',
        amountInr,
      }),
    ).toEqual({ ok: false, reason: 'amount-invalid' });
  });

  it('labels the request as the user number and each given rupee as computed', () => {
    const outcome = move(scene(), 'venue', 30_000);
    expect(outcome.requested).toEqual({ inr: 30_000, provenance: 'your-number' });
    expect(outcome.givers.every((giver) => giver.amount.provenance === 'computed')).toBe(true);
  });

  it('does not change the frozen split it was given', () => {
    const s = scene();
    const before = structuredClone(s.split);
    move(s, 'venue', 100_000);
    expect(s.split).toEqual(before);
  });
});
