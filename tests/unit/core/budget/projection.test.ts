import { describe, expect, it } from 'vitest';

import type { Category } from '@/schemas/readings/vocabulary';

import type { BudgetRefusal } from '@/core/budget/budget-refusal';
import type { FrozenSplit } from '@/core/budget/frozen-split';
import { scaledForGuests } from '@/core/budget/guest-scaling';
import type { Projection, ProjectionEvidence } from '@/core/budget/projection';
import { projectSpend } from '@/core/budget/projection';

import { CATEGORIES, amountsOf, splitFor } from './draft-data';

function project(
  split: FrozenSplit,
  overrides: {
    guestsNow?: number;
    budgetNowInr?: number;
    evidence?: ProjectionEvidence;
    deltas?: Partial<Record<Category, number>>;
  } = {},
): Projection {
  const result = projectSpend({
    split,
    deltas: overrides.deltas ?? {},
    guestsNow: overrides.guestsNow ?? split.guestsAtSplit,
    budgetNowInr: overrides.budgetNowInr ?? split.budgetAtSplit.inr,
    evidence: overrides.evidence ?? {},
  });
  if (!result.ok) throw new Error(`The test projection was refused: ${result.reason}`);
  return result.value;
}

function projectedOf(view: Projection): Record<Category, number> {
  return Object.fromEntries(
    CATEGORIES.map((category) => [category, view.lines[category].projected.inr]),
  ) as Record<Category, number>;
}

describe('projectSpend on a fresh plan', () => {
  it('projects exactly the budget, with no gap and no headroom', () => {
    const split = splitFor();
    const view = project(split);
    expect(view.projectedTotal.inr).toBe(800_000);
    expect(view.gap.inr).toBe(0);
    expect(view.headroom.inr).toBe(0);
    expect(view.status).toBe('within-budget');
    expect(view.overAllocated).toEqual([]);
    expect(projectedOf(view)).toEqual(amountsOf(split));
  });

  it('labels each allocation-based line as the user split', () => {
    const view = project(splitFor());
    for (const category of CATEGORIES) {
      expect(view.lines[category].source).toBe('allocation');
      expect(view.lines[category].projected.provenance).toBe('your-split');
    }
    expect(view.gap.provenance).toBe('computed');
    expect(view.projectedTotal.provenance).toBe('computed');
    expect(view.budget.provenance).toBe('your-number');
  });
});

describe('projectSpend scales each category by its per-guest share', () => {
  it('moves decor to 55,650 and invitations to 66,250 when guests go from 200 to 250', () => {
    // Pinned from FR-10 and spec 5.2: shares 20 and 100 percent, g_alloc 200.
    const view = project(splitFor(), { guestsNow: 250 });
    expect(view.lines.decor.projected.inr).toBe(55_650);
    expect(view.lines.invites.projected.inr).toBe(66_250);
  });

  it('leaves photo and music unscaled, as their share in the data is zero', () => {
    const split = splitFor();
    const view = project(split, { guestsNow: 250 });
    expect(view.lines.photo.projected.inr).toBe(split.lines.photo.allocation.inr);
    expect(view.lines.music.projected.inr).toBe(split.lines.music.allocation.inr);
  });

  it('scales every category by the formula in integers, taking shares from the split', () => {
    const split = splitFor();
    const view = project(split, { guestsNow: 250 });
    for (const category of CATEGORIES) {
      const { allocation, perGuestSharePercent } = split.lines[category];
      const shift = Math.round((allocation.inr * perGuestSharePercent * 50) / (100 * 200));
      const expected = category === 'contingency' ? allocation.inr : allocation.inr + shift;
      expect(view.lines[category].projected.inr).toBe(expected);
    }
  });

  it('shrinks the guest-driven categories when guests fall to 100', () => {
    const view = project(splitFor(), { guestsNow: 100 });
    // Hand-pinned: decor 53,000 x (1 - 0.2 x 0.5) and invitations 53,000 x 0.5.
    expect(view.lines.decor.projected.inr).toBe(47_700);
    expect(view.lines.invites.projected.inr).toBe(26_500);
  });

  it('never scales contingency, even if a profile gave it a per-guest share', () => {
    const split = splitFor();
    const greedy: FrozenSplit = {
      ...split,
      lines: {
        ...split.lines,
        contingency: { ...split.lines.contingency, perGuestSharePercent: 100 },
      },
    };
    expect(project(greedy, { guestsNow: 400 }).lines.contingency.projected.inr).toBe(76_000);
  });

  it('adds a Move-money delta to the allocation before scaling', () => {
    const view = project(splitFor(), { guestsNow: 250, deltas: { decor: 10_000 } });
    // (53,000 + 10,000) x (1 + 0.2 x 0.25) = 66,150
    expect(view.lines.decor.allocation.inr).toBe(63_000);
    expect(view.lines.decor.projected.inr).toBe(66_150);
  });

  // The shift is allocation x share x extra guests / (100 x guests at split), worked by hand.
  it.each([
    ['a quarter of a rupee rounds down', 1, 50, 1],
    ['three quarters of a rupee rounds up', 3, 50, 4],
    ['exactly half a rupee rounds up', 1, 100, 2],
  ])('%s', (_name, allocation, share, expected) => {
    expect(scaledForGuests(allocation, share, 2, 3)).toEqual({
      ok: true,
      value: { inr: expected, provenance: 'your-split' },
    });
  });

  it('stays exact for the largest budget and a thousand-fold guest rise', () => {
    const result = scaledForGuests(100_000_000, 100, 1, 5_000);
    expect(result).toEqual({ ok: true, value: { inr: 500_000_000_000, provenance: 'your-split' } });
  });
});

describe('projectSpend keeps the split frozen at the brief (D09)', () => {
  it('leaves every allocation alone when the budget falls to 7,50,000 and shows a gap', () => {
    const split = splitFor();
    const before = structuredClone(split);
    const view = project(split, { budgetNowInr: 750_000 });
    expect(split).toEqual(before);
    expect(amountsOf(split)).toEqual(amountsOf(before));
    expect(view.gap.inr).toBe(50_000);
    expect(view.status).toBe('over-budget');
    expect(view.headroom.inr).toBe(0);
  });

  it('shows a gap, not a re-split, when guests rise and the budget does not', () => {
    const view = project(splitFor(), { guestsNow: 250 });
    expect(view.gap.inr).toBe(view.projectedTotal.inr - 800_000);
    expect(view.gap.inr).toBeGreaterThan(0);
  });

  it('measures headroom against the current budget when the budget rises', () => {
    const view = project(splitFor(), { budgetNowInr: 900_000 });
    expect(view.gap.inr).toBe(-100_000);
    expect(view.headroom.inr).toBe(100_000);
    expect(view.status).toBe('within-budget');
  });
});

describe('projectSpend picks the amount by precedence', () => {
  const split = splitFor();
  const allocation = split.lines.venue.allocation.inr;

  it('prefers a lever-adjusted amount over a booking and a quote', () => {
    const view = project(split, {
      evidence: {
        venue: {
          bookedInr: 180_000,
          quote: { totalInr: 170_000, plusGstRateNotStated: false },
          lever: { projectedInr: 150_000, exact: false },
        },
      },
    });
    expect(view.lines.venue.source).toBe('lever');
    expect(view.lines.venue.projected).toEqual({ inr: 150_000, provenance: 'assumption' });
    expect(view.lines.venue.held).toEqual({ booked: true, quoted: true, levered: true });
  });

  it('labels an exact lever saving as computed rather than a planning assumption', () => {
    const view = project(split, {
      evidence: { contingency: { lever: { projectedInr: 38_000, exact: true } } },
    });
    expect(view.lines.contingency.projected).toEqual({ inr: 38_000, provenance: 'computed' });
  });

  it('prefers a booked amount over a quote, and labels it as the user number', () => {
    const view = project(split, {
      evidence: {
        venue: { bookedInr: 180_000, quote: { totalInr: 170_000, plusGstRateNotStated: false } },
      },
    });
    expect(view.lines.venue.source).toBe('booked');
    expect(view.lines.venue.projected).toEqual({ inr: 180_000, provenance: 'your-number' });
  });

  it('prefers a quote over the scaled allocation, labelled from the quote', () => {
    const view = project(split, {
      guestsNow: 250,
      evidence: { venue: { quote: { totalInr: 170_000, plusGstRateNotStated: false } } },
    });
    expect(view.lines.venue.source).toBe('quote');
    expect(view.lines.venue.projected).toEqual({ inr: 170_000, provenance: 'from-quote' });
    expect(view.lines.venue.note).toBeNull();
  });

  it('treats a booked amount of zero as the number the user typed, not as unset', () => {
    const view = project(split, { evidence: { venue: { bookedInr: 0 } } });
    expect(view.lines.venue.source).toBe('booked');
    expect(view.lines.venue.projected.inr).toBe(0);
    expect(view.gap.inr).toBe(-allocation);
  });

  it('flags a quote whose tax rate is unstated and leaves the tax out of the total', () => {
    const view = project(split, {
      evidence: { catering: { quote: { totalInr: 260_000, plusGstRateNotStated: true } } },
    });
    expect(view.lines.catering.note).toBe('plus-gst-rate-not-stated');
    expect(view.lines.catering.projected.inr).toBe(260_000);
  });

  it('lists each line that projects above its allocation, with how far', () => {
    const view = project(split, { evidence: { venue: { bookedInr: 180_000 } } });
    expect(view.overAllocated).toEqual(['venue']);
    expect(view.lines.venue.overAllocationBy).toEqual({
      inr: 180_000 - allocation,
      provenance: 'computed',
    });
    expect(view.lines.decor.overAllocationBy).toBeNull();
  });
});

describe('projectSpend on the change test of spec 5.2', () => {
  it('projects Rs 7,98,900, over the new Rs 7,50,000 budget by Rs 48,900', () => {
    const view = project(splitFor(), {
      guestsNow: 250,
      budgetNowInr: 750_000,
      evidence: {
        venue: { bookedInr: 180_000 },
        catering: { quote: { totalInr: 300_000, plusGstRateNotStated: false } },
      },
    });
    // Hand-pinned from spec 5.2 step 3: 180,000 + 300,000 + 55,650 + 76,000 + 45,000 + 66,250 + 76,000.
    expect(view.projectedTotal.inr).toBe(798_900);
    expect(view.gap.inr).toBe(48_900);
    expect(view.status).toBe('over-budget');
  });
});

describe('projectSpend refuses what it cannot project', () => {
  const split = splitFor();
  const base = {
    split,
    deltas: {},
    guestsNow: 200,
    budgetNowInr: 800_000,
    evidence: {} as ProjectionEvidence,
  };

  it.each<[string, number, BudgetRefusal]>([
    ['zero guests', 0, 'guests-out-of-range'],
    ['negative guests', -4, 'guests-out-of-range'],
    ['fractional guests', 2.5, 'guests-out-of-range'],
    ['NaN guests', Number.NaN, 'guests-out-of-range'],
  ])('refuses %s', (_name, guestsNow, reason) => {
    expect(projectSpend({ ...base, guestsNow })).toEqual({ ok: false, reason });
  });

  it.each<[string, number]>([
    ['zero', 0],
    ['negative', -1],
    ['NaN', Number.NaN],
  ])('refuses a current budget of %s', (_name, budgetNowInr) => {
    expect(projectSpend({ ...base, budgetNowInr })).toEqual({
      ok: false,
      reason: 'budget-out-of-range',
    });
  });

  it.each<[string, ProjectionEvidence]>([
    ['a negative booked amount', { venue: { bookedInr: -1 } }],
    ['a fractional booked amount', { venue: { bookedInr: 10.5 } }],
    [
      'a NaN quote total',
      { venue: { quote: { totalInr: Number.NaN, plusGstRateNotStated: false } } },
    ],
    ['a negative lever amount', { venue: { lever: { projectedInr: -5, exact: true } } }],
  ])('refuses %s', (_name, evidence) => {
    expect(projectSpend({ ...base, evidence })).toEqual({ ok: false, reason: 'amount-invalid' });
  });

  it('refuses a delta that would take an allocation below zero', () => {
    expect(projectSpend({ ...base, deltas: { decor: -60_000 } })).toEqual({
      ok: false,
      reason: 'amount-invalid',
    });
  });

  it('refuses a split whose guests at allocation is zero rather than dividing by it', () => {
    const corrupt: FrozenSplit = { ...split, guestsAtSplit: 0 };
    expect(projectSpend({ ...base, split: corrupt })).toEqual({
      ok: false,
      reason: 'guests-out-of-range',
    });
  });
});
