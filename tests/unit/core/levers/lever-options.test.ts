import { describe, expect, it } from 'vitest';

import { leverOptions, type LeverNow } from '@/core/levers/lever-options';
import type { LeverOption as Option } from '@/core/levers/lever-types';
import { projectSpend } from '@/core/budget/projection';
import type { ProjectionInput } from '@/core/budget/projection';

import { priorities, splitFor } from '../budget/draft-data';
import { afterTheChange, context, leverRows, overBudget } from './lever-data';

function optionsFor(input: ProjectionInput, forContext = context()): ReadonlyMap<string, Option> {
  const view = projectSpend(input);
  if (!view.ok) throw new Error(view.reason);
  const options = leverOptions(forContext, view.value, { gapInr: view.value.gap.inr, chosen: [] });
  if (!options.ok) throw new Error(options.reason);
  return new Map(options.value.map((option) => [option.id, option]));
}

function get(options: ReadonlyMap<string, Option>, id: string): Option {
  const found = options.get(id);
  if (found === undefined) throw new Error(`No option ${id}`);
  return found;
}

describe('leverOptions on a plan over budget by about 20 percent (spec 5.3)', () => {
  const options = optionsFor(overBudget(), context(['dhol']));

  // Pinned by hand from the spec: 9,57,000 projected against 8,00,000.
  it.each([
    ['simpler-decor', 15_900, 'assumption'],
    ['e-invites', 21_200, 'assumption'],
    ['leaner-photo', 30_000, 'assumption'],
    ['half-contingency', 38_000, 'computed'],
    ['raise-budget', 157_000, 'computed'],
  ])('offers %s saving Rs %s, labelled %s', (id, saving, provenance) => {
    const option = get(options, id);
    expect(option.status).toBe('offered');
    expect(option.saving).toEqual({ inr: saving, provenance });
  });

  it('lists every lever in the data, in data order', () => {
    expect([...options.keys()]).toEqual(leverRows.map((row) => row.id));
  });

  it('refuses the menu lever for food, which is the family priority, but shows its saving', () => {
    const menu = get(options, 'simpler-menu');
    expect(menu.status).toBe('refused');
    expect(menu.reason).toEqual({ kind: 'invest-more', category: 'catering' });
    expect(menu.saving).toEqual({ inr: 54_000, provenance: 'assumption' });
    expect(menu.percent).toBe(15);
    expect(menu.showAnywayAllowed).toBe(true);
  });

  it('disables the band lever because dhol is a must-have, and still shows its saving', () => {
    const band = get(options, 'smaller-band');
    expect(band.status).toBe('disabled');
    expect(band.reason).toEqual({ kind: 'must-have', mustHave: 'dhol' });
    expect(band.saving.inr).toBe(22_500);
    expect(band.showAnywayAllowed).toBe(false);
  });

  it('names the buffer left when half the contingency is used', () => {
    expect(get(options, 'half-contingency').bufferLeft).toEqual({
      inr: 38_000,
      provenance: 'computed',
    });
    expect(get(options, 'simpler-decor').bufferLeft).toBeNull();
  });

  it('carries the consequence sentence and basis in both languages', () => {
    for (const option of options.values()) {
      expect(option.consequence.en.length).toBeGreaterThan(0);
      expect(option.consequence.hi).toMatch(/[ऀ-ॿ]/);
      expect(option.label.hi).toMatch(/[ऀ-ॿ]/);
      expect(option.basis).toMatch(/^Planning assumption/);
    }
  });

  it('gives every saving a provenance label, refused and disabled levers included', () => {
    for (const option of options.values()) {
      expect(['assumption', 'computed']).toContain(option.saving.provenance);
      expect(option.saving.provenance).toBe(
        option.provenance === 'exact' ? 'computed' : 'assumption',
      );
    }
  });

  it('names the task the e-invite lever switches to its faster alternative', () => {
    expect(get(options, 'e-invites').fasterAlternativeFor).toBe('print-invitations');
    expect(get(options, 'simpler-decor').fasterAlternativeFor).toBeNull();
  });

  it('has no switch-to-the-cheaper-quote lever and no trim-guests lever', () => {
    expect(leverRows.map((row) => row.id)).not.toContain('cheaper-quote');
    expect(leverRows.map((row) => row.id)).not.toContain('trim-guests');
  });
});

describe('leverOptions eligibility order', () => {
  it('turns the food lever from refused to offered when food is revised to standard (D13)', () => {
    const standard = priorities({ decor: 'save' });
    const options = optionsFor(overBudget(), context([], standard));
    expect(get(options, 'simpler-menu').status).toBe('offered');
    expect(get(options, 'simpler-menu').reason).toBeNull();
  });

  it('disables a lever for a must-have before it considers the category priority', () => {
    const music = priorities({ catering: 'more', music: 'more' });
    const band = get(optionsFor(overBudget(), context(['dhol'], music)), 'smaller-band');
    expect(band.status).toBe('disabled');
  });

  it('shows a must-have lever as offered when the family did not name the must-have', () => {
    expect(get(optionsFor(overBudget()), 'smaller-band').status).toBe('offered');
  });

  it('marks a lever on a booked category not applicable, with the booking as the reason', () => {
    const input = overBudget();
    const booked = { ...input, evidence: { ...input.evidence, decor: { bookedInr: 60_000 } } };
    const decor = get(optionsFor(booked), 'simpler-decor');
    expect(decor.status).toBe('not-applicable');
    expect(decor.reason).toEqual({ kind: 'booked', category: 'decor' });
    expect(decor.showAnywayAllowed).toBe(false);
  });

  it('refuses before it calls a booked invest-more category not applicable, but allows no override', () => {
    const input = overBudget();
    const booked = { ...input, evidence: { ...input.evidence, catering: { bookedInr: 400_000 } } };
    const menu = get(optionsFor(booked), 'simpler-menu');
    expect(menu.status).toBe('refused');
    expect(menu.showAnywayAllowed).toBe(false);
  });

  it('lists the levers of a contingency the family wants to invest in as refused', () => {
    const reserve = priorities({ catering: 'more', contingency: 'more' });
    expect(get(optionsFor(overBudget(), context([], reserve)), 'half-contingency').status).toBe(
      'refused',
    );
  });
});

describe('leverOptions on other plans', () => {
  it('gives no levers for a plan within budget', () => {
    const input: ProjectionInput = {
      split: splitFor(),
      deltas: {},
      guestsNow: 200,
      budgetNowInr: 800_000,
      evidence: {},
    };
    expect(optionsFor(input).size).toBe(0);
  });

  it('measures savings on the plan as it stands after the change (spec 5.2)', () => {
    const options = optionsFor(afterTheChange(), context(['dhol']));
    // Pinned by hand: invitations 53,000 x 1.25 = 66,250, of which 40 percent is 26,500.
    expect(get(options, 'e-invites').saving.inr).toBe(26_500);
    expect(get(options, 'half-contingency').saving.inr).toBe(38_000);
    expect(get(options, 'raise-budget').saving.inr).toBe(48_900);
  });

  it.each([
    [1_001, 250],
    [1_002, 251],
    [1_003, 251],
  ])('rounds a percent saving half up: 25 percent of %s is %s', (photo, saving) => {
    const input = overBudget();
    const quoted = { quote: { totalInr: photo, plusGstRateNotStated: false } };
    const changed = { ...input, evidence: { ...input.evidence, photo: quoted } };
    expect(get(optionsFor(changed), 'leaner-photo').saving.inr).toBe(saving);
  });

  it('takes the floor of half an odd contingency', () => {
    // Pinned by hand: half of 77,001 is 38,500.5, and the saving is the whole rupees below it.
    const input = overBudget();
    const reserve = {
      ...input,
      evidence: { ...input.evidence, contingency: { bookedInr: 77_001 } },
    };
    const half = get(optionsFor(reserve), 'half-contingency');
    expect(half.saving.inr).toBe(38_500);
    expect(half.bufferLeft?.inr).toBe(38_501);
  });
});

describe('leverOptions edge cases', () => {
  it('rejects nothing and mutates nothing: the same inputs give the same list', () => {
    const view = projectSpend(overBudget());
    if (!view.ok) throw new Error(view.reason);
    const before = JSON.stringify(view.value);
    const now = { gapInr: view.value.gap.inr, chosen: [] };
    expect(leverOptions(context(), view.value, now)).toEqual(
      leverOptions(context(), view.value, now),
    );
    expect(JSON.stringify(view.value)).toBe(before);
  });

  it('saves nothing on a category that costs nothing', () => {
    const input = overBudget();
    const quoted = { quote: { totalInr: 0, plusGstRateNotStated: false } };
    const free = { ...input, evidence: { ...input.evidence, photo: quoted } };
    expect(get(optionsFor(free), 'leaner-photo').saving.inr).toBe(0);
  });
});

describe('raising the budget after levers already in force', () => {
  const view = projectSpend(overBudget());
  if (!view.ok) throw new Error(view.reason);
  const ids = (now: LeverNow): readonly Option[] => {
    const options = leverOptions(context(['dhol']), view.value, now);
    if (!options.ok) throw new Error(options.reason);
    return options.value;
  };
  const others = leverRows.map((row) => row.id).filter((id) => id !== 'raise-budget');

  it('is not offered once the chosen levers leave the plan within budget', () => {
    for (const gapInr of [0, -220]) {
      const options = ids({ gapInr, chosen: ['e-invites', 'half-contingency'] });
      expect(options.map((option) => option.id)).toEqual(others);
    }
  });

  it('closes exactly the gap that is left, not the gap before the levers', () => {
    const raise = ids({ gapInr: 6_575, chosen: ['e-invites'] }).find(
      (option) => option.id === 'raise-budget',
    );
    expect(raise?.saving).toEqual({ inr: 6_575, provenance: 'computed' });
    expect(raise?.status).toBe('offered');
  });

  it('stays listed when it is itself chosen, so the page can show it as chosen', () => {
    const options = ids({ gapInr: 0, chosen: ['raise-budget'] });
    expect(options.find((option) => option.id === 'raise-budget')?.saving.inr).toBe(0);
  });

  it('leaves every other lever measured on the plan before the levers', () => {
    const before = ids({ gapInr: view.value.gap.inr, chosen: [] }).filter(
      (option) => option.id !== 'raise-budget',
    );
    expect(ids({ gapInr: -220, chosen: [] })).toEqual(before);
  });
});
