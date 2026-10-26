import { describe, expect, it } from 'vitest';

import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';
import type { Category, Priority } from '@/schemas/readings/vocabulary';

import { allocateBudget } from '@/core/budget/allocation';
import type { BudgetRefusal } from '@/core/budget/budget-refusal';
import { floorInr } from '@/core/budget/budget-profile';

import {
  CATEGORIES,
  DEMO_PRIORITIES,
  NAMED_OCCASIONS,
  allocationInput,
  amountsOf,
  budgetWeights,
  priorities,
  splitFor,
} from './draft-data';

const total = (amounts: Record<Category, number>): number =>
  CATEGORIES.reduce((sum, category) => sum + amounts[category], 0);

describe('allocateBudget on the spec demo split', () => {
  it('splits 8 lakh with food invest-more and decor save to the rupee', () => {
    // Pinned by hand from 12-requirements FR-7 and architecture 4.1 (W = 105.75).
    expect(amountsOf(splitFor())).toEqual({
      venue: 166_000,
      catering: 331_000,
      decor: 53_000,
      photo: 76_000,
      music: 45_000,
      invites: 53_000,
      contingency: 76_000,
    });
  });

  it('labels every allocation as the user split and the budget as the user number', () => {
    const split = splitFor();
    for (const category of CATEGORIES) {
      expect(split.lines[category].allocation.provenance).toBe('your-split');
    }
    expect(split.budgetAtSplit).toEqual({ inr: 800_000, provenance: 'your-number' });
  });

  it('keeps the brief guest count as the guests the allocation was made for', () => {
    expect(splitFor({ guests: 137 }).guestsAtSplit).toBe(137);
  });

  it('splits an all-standard 8 lakh by the base weights read from the data', () => {
    const wedding = budgetWeights.profiles.find((profile) => profile.id === 'wedding');
    const weightSum = wedding?.categories.reduce((sum, row) => sum + row.baseWeight, 0) ?? 0;
    const amounts = amountsOf(splitFor({ priorities: priorities() }));
    // 8 lakh divides by the weight sum of 100 here, so each share is exact.
    expect(800_000 % weightSum).toBe(0);
    for (const row of wedding?.categories ?? []) {
      expect(amounts[row.category]).toBe((800_000 / weightSum) * row.baseWeight);
    }
    // Pinned by hand against the draft weights: 22/35/10/10/6/7/10 percent.
    expect(amounts).toEqual({
      venue: 176_000,
      catering: 280_000,
      decor: 80_000,
      photo: 80_000,
      music: 48_000,
      invites: 56_000,
      contingency: 80_000,
    });
  });

  it('gives a different split for 12 lakh that still sums to 12 lakh', () => {
    const eight = amountsOf(splitFor());
    const twelve = amountsOf(splitFor({ budgetInr: 1_200_000 }));
    expect(twelve).not.toEqual(eight);
    expect(total(twelve)).toBe(1_200_000);
  });

  it('treats an unclear priority as standard', () => {
    expect(amountsOf(splitFor({ priorities: priorities({}, 'unclear') }))).toEqual(
      amountsOf(splitFor({ priorities: priorities() })),
    );
  });

  it('weighs a save category below standard and an invest-more above it', () => {
    const base = amountsOf(splitFor({ priorities: priorities() }));
    const shifted = amountsOf(
      splitFor({ priorities: priorities({ photo: 'save', music: 'more' }) }),
    );
    expect(shifted.photo).toBeLessThan(base.photo);
    expect(shifted.music).toBeGreaterThan(base.music);
  });

  it('gives the same split twice for the same input', () => {
    expect(splitFor()).toEqual(splitFor());
  });
});

describe('allocateBudget on the small-celebration profile', () => {
  it('splits a Rs 10,000 birthday for 25 guests to the nearest Rs 100', () => {
    const split = splitFor({
      occasion: 'birthday',
      budgetInr: 10_000,
      guests: 25,
      priorities: priorities(),
    });
    expect(split.profile).toBe('celebration');
    expect(split.roundingUnitInr).toBe(100);
    // Pinned by hand: 20/40/12/6/6/6/10 percent of Rs 10,000.
    expect(amountsOf(split)).toEqual({
      venue: 2_000,
      catering: 4_000,
      decor: 1_200,
      photo: 600,
      music: 600,
      invites: 600,
      contingency: 1_000,
    });
  });

  it.each(NAMED_OCCASIONS)('uses the profile the data names for %s', (occasion) => {
    const expected = budgetWeights.profiles.find((profile) => profile.occasions.includes(occasion));
    const split = splitFor({ occasion });
    expect(split.profile).toBe(expected?.id);
    expect(split.order).toEqual(expected?.categories.map((row) => row.category));
  });

  it('keeps the floor and per-guest share of each category from its own profile', () => {
    const split = splitFor({ occasion: 'other' });
    const celebration = budgetWeights.profiles.find((profile) => profile.id === 'celebration');
    for (const row of celebration?.categories ?? []) {
      expect(split.lines[row.category].perGuestSharePercent).toBe(row.perGuestSharePercent);
      expect(split.lines[row.category].floor).toEqual(row.floor);
    }
  });
});

describe('allocateBudget keeps its promises across budgets and priorities', () => {
  const edgeBudgets = [
    5_000, 5_050, 9_999, 10_000, 99_999, 100_000, 100_500, 123_457, 800_000, 100_000_000,
  ];
  const mixes: [string, Record<Category, Priority>][] = [
    ['all standard', priorities()],
    ['all save', priorities({}, 'save')],
    ['all invest-more', priorities({}, 'more')],
    ['contingency save, the rest invest-more', priorities({ contingency: 'save' }, 'more')],
    ['the demo mix', DEMO_PRIORITIES],
  ];

  it.each(
    edgeBudgets.flatMap((budget) => mixes.map(([name, mix]) => [budget, name, mix] as const)),
  )(
    'sums exactly to Rs %i with %s, none negative, contingency above its floor',
    (budget, _name, mix) => {
      for (const occasion of ['wedding', 'birthday'] as const) {
        const split = splitFor({ budgetInr: budget, occasion, priorities: mix });
        const amounts = amountsOf(split);
        expect(total(amounts)).toBe(budget);
        for (const category of CATEGORIES) {
          expect(amounts[category]).toBeGreaterThanOrEqual(0);
          if (category !== 'contingency') expect(amounts[category] % split.roundingUnitInr).toBe(0);
        }
        const minimum = floorInr(split.lines.contingency.floor, 0, budget);
        expect(amounts.contingency).toBeGreaterThanOrEqual(minimum);
      }
    },
  );

  it('puts the remainder of a budget that is not a multiple of Rs 1,000 into contingency', () => {
    const amounts = amountsOf(splitFor({ budgetInr: 800_500 }));
    expect(amounts.contingency % 1000).toBe(500);
    expect(total(amounts)).toBe(800_500);
  });

  it('uses a Rs 1,000 unit from Rs 1 lakh and a Rs 100 unit below it', () => {
    expect(splitFor({ budgetInr: 99_999 }).roundingUnitInr).toBe(100);
    expect(splitFor({ budgetInr: 100_000 }).roundingUnitInr).toBe(1000);
  });

  it('takes rupees back from the largest categories when rounding leaves contingency short', () => {
    // A hand-made profile with a 1 percent contingency weight forces the guard to run.
    const thin: BudgetWeightsFile = {
      ...budgetWeights,
      profiles: budgetWeights.profiles.map((profile) => ({
        ...profile,
        categories: profile.categories.map((row) =>
          row.category === 'contingency' ? { ...row, baseWeight: 1 } : row,
        ),
      })),
    };
    const result = allocateBudget(allocationInput({ budgetInr: 800_000 }), thin);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const amounts = amountsOf(result.value);
    expect(amounts.contingency).toBeGreaterThanOrEqual(40_000);
    expect(total(amounts)).toBe(800_000);
  });
});

describe('allocateBudget refuses what it cannot split', () => {
  it.each<[string, number, BudgetRefusal]>([
    ['zero', 0, 'budget-out-of-range'],
    ['a negative budget', -1, 'budget-out-of-range'],
    ['one rupee under the Rs 5,000 floor', 4_999, 'budget-out-of-range'],
    ['one rupee over Rs 10 crore', 100_000_001, 'budget-out-of-range'],
    ['NaN', Number.NaN, 'not-a-number'],
    ['Infinity', Number.POSITIVE_INFINITY, 'out-of-range'],
    ['a fraction of a rupee', 5_000.5, 'not-whole-rupees'],
  ])('refuses a budget of %s with a typed reason', (_name, budgetInr, reason) => {
    expect(allocateBudget(allocationInput({ budgetInr }), budgetWeights)).toEqual({
      ok: false,
      reason,
    });
  });

  it.each<[string, number, BudgetRefusal]>([
    ['zero', 0, 'guests-out-of-range'],
    ['negative', -5, 'guests-out-of-range'],
    ['NaN', Number.NaN, 'not-a-number'],
    ['fractional', 2.5, 'not-whole-rupees'],
  ])('refuses %s guests so g_alloc is never a bad divisor', (_name, guests, reason) => {
    expect(allocateBudget(allocationInput({ guests }), budgetWeights)).toEqual({
      ok: false,
      reason,
    });
  });

  it('refuses an occasion no profile names', () => {
    const none: BudgetWeightsFile = {
      ...budgetWeights,
      profiles: budgetWeights.profiles.map((profile) => ({
        ...profile,
        occasions: profile.occasions.filter((occasion) => occasion !== 'puja'),
      })),
    };
    expect(allocateBudget(allocationInput({ occasion: 'puja' }), none)).toEqual({
      ok: false,
      reason: 'no-profile-for-occasion',
    });
  });

  it('refuses a priority with no multiplier row', () => {
    const noSave: BudgetWeightsFile = {
      ...budgetWeights,
      multipliers: budgetWeights.multipliers.filter((row) => row.priority !== 'save'),
    };
    expect(allocateBudget(allocationInput(), noSave)).toEqual({
      ok: false,
      reason: 'priority-without-multiplier',
    });
  });

  it('refuses a profile that leaves a category out', () => {
    const missing: BudgetWeightsFile = {
      ...budgetWeights,
      profiles: budgetWeights.profiles.map((profile) => ({
        ...profile,
        categories: profile.categories.filter((row) => row.category !== 'music'),
      })),
    };
    const result = allocateBudget(allocationInput({ priorities: priorities() }), missing);
    expect(result.ok).toBe(false);
  });
});
