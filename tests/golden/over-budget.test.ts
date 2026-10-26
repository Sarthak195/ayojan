// Over budget by about 20 percent (spec 5.3, FR-31, FR-32), replayed offline with today =
// 2026-10-31: a fresh Rs 8,00,000, 200 guest plan with the spec 5.1 priorities (food invest
// more, decor save, dhol a must-have) and three quotes. The plan views before and after the
// quotes are pinned whole, and so is the lever outcome of each selection below.
//
// Hand check against the spec's design-time values, done before pinning:
//   v1  projected Rs 8,00,000, within budget, no lever on offer.                      matches
//   v4  venue Rs 2,50,000, catering 200 x Rs 1,800 = Rs 3,60,000, photo Rs 1,20,000;
//       projected Rs 9,57,000, "Over budget by Rs 1,57,000".                          matches
//   Levers: simpler decor Rs 15,900, e-invites Rs 21,200, leaner photo Rs 30,000 (25 percent
//       of the quote), half the contingency Rs 38,000 exact with Rs 38,000 left, raise the
//       budget Rs 1,57,000; simpler menu refused with its Rs 54,000 saving shown; smaller
//       band disabled by the dhol.                                                    matches
//   All four non-priority levers: "Selected saves Rs 1,05,100; now Rs 51,900 over budget"
//       and the remaining choice is the refused food lever, a higher budget or fewer guests.
//                                                                                     matches
// Divergence: the spec words the running line "still Rs 51,900 over"; the lever module's
// sentence reads "now Rs 51,900 over budget" (one wording for over, under and on budget).
//
// Re-pinned after the 2026-10-26 data review: only labels moved (venue Hindi to "वेन्यू", the
// music task renamed to band, dhol or DJ, the e-invite and lever wording) and final-walkthrough
// gained decor-sign-off in dependsOn; mandap still binds the walkthrough, so no date or rupee
// value changed.

import { describe, expect, it } from 'vitest';

import { parseIsoDate, type IsoDate } from '@/core/calendar/day-number';
import { previewSelection, type SelectionResult } from '@/core/levers/selection';
import { runningLineSentence } from '@/core/levers/running-line';
import { viewOfOps, type PlanView } from '@/core/plan/plan-view';
import type { Op } from '@/schemas/plan/op';

import { AI_READ, BRIEF_OP, OVER_BUDGET_QUOTES, PLAN_DATA, TODAY } from '../fixtures/plan-readings';
import { expectPinned } from './golden-pin';

const today = ((): IsoDate => {
  const parsed = parseIsoDate(TODAY);
  if (!parsed.ok) throw new Error('bad TODAY');
  return parsed.value;
})();

function viewOf(ops: readonly Op[]): PlanView {
  const view = viewOfOps(ops, PLAN_DATA, today);
  if (!view.ok) throw new Error(`refused: ${JSON.stringify(view.refusal)}`);
  return view.value;
}

const quoteOps: Op[] = OVER_BUDGET_QUOTES.map((quote) => ({
  kind: 'quoteAdded',
  quote,
  readBy: AI_READ,
}));
const v1 = viewOf([BRIEF_OP]);
const v4 = viewOf([BRIEF_OP, ...quoteOps]);

function choose(selected: readonly string[], showAnyway: readonly string[] = []): SelectionResult {
  return previewSelection({
    levers: PLAN_DATA.levers.levers,
    priorities: v4.current.priorities,
    mustHaves: v4.current.brief.mustHaves,
    base: v4.current.money.input,
    selected,
    showAnyway,
  });
}

function option(id: string): PlanView['current']['money']['options'][number] {
  const found = v4.current.money.options.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no lever ${id}`);
  return found;
}

describe('over budget by about 20 percent (spec 5.3)', () => {
  it('starts within budget with nothing to trade off', () => {
    expect(v1.current.headline.projected.inr).toBe(800_000);
    expect(v1.current.money.options).toEqual([]);
    expect(v1.banners).toEqual([]);
  });

  it('is over by Rs 1,57,000 once the three quotes are in, with each over-allocated line', () => {
    const { headline, money } = v4.current;
    expect([headline.projected.inr, headline.gap.inr, headline.status]).toEqual([
      957_000,
      157_000,
      'over-budget',
    ]);
    expect(money.projection.overAllocated).toEqual(['venue', 'catering', 'photo']);
    expect(v4.banners).toEqual([{ kind: 'over-budget', gapInr: 157_000 }]);
  });

  it.each([
    ['simpler-decor', 'offered', 15_900, 'assumption'],
    ['e-invites', 'offered', 21_200, 'assumption'],
    ['leaner-photo', 'offered', 30_000, 'assumption'],
    ['simpler-menu', 'refused', 54_000, 'assumption'],
    ['smaller-band', 'disabled', 22_500, 'assumption'],
    ['half-contingency', 'offered', 38_000, 'computed'],
    ['raise-budget', 'offered', 157_000, 'computed'],
  ])('lists %s as %s saving Rs %i (%s)', (id, status, saving, provenance) => {
    expect([option(id).status, option(id).saving]).toEqual([status, { inr: saving, provenance }]);
  });

  it('leaves Rs 38,000 in the reserve after half the contingency', () => {
    expect(option('half-contingency').bufferLeft).toEqual({ inr: 38_000, provenance: 'computed' });
  });

  it('pre-selects nothing and has applied no lever', () => {
    expect(v4.current.leverIds).toEqual([]);
    expect(v4.current.money.applied).toEqual([]);
  });

  it('with every non-priority lever ticked, still Rs 51,900 over and says what remains', () => {
    const all = choose(['simpler-decor', 'e-invites', 'leaner-photo', 'half-contingency']);
    if (!all.ok) throw new Error(JSON.stringify(all.refusal));
    expect(runningLineSentence(all.value.line, 'en')).toBe(
      'Selected saves Rs 1,05,100; now Rs 51,900 over budget',
    );
    expect(all.value.exhausted).toBe(true);
    expect(all.value.remainingRefused).toEqual(['simpler-menu']);
    expectPinned('over-budget.all-four', all.value);
  });

  it('refuses the food lever without "Show anyway" and the band lever always', () => {
    expect(choose(['simpler-menu'])).toEqual({
      ok: false,
      refusal: {
        kind: 'lever-refused',
        id: 'simpler-menu',
        reason: { kind: 'invest-more', category: 'catering' },
      },
    });
    expect(choose(['smaller-band'])).toEqual({
      ok: false,
      refusal: {
        kind: 'lever-disabled',
        id: 'smaller-band',
        reason: { kind: 'must-have', mustHave: 'dhol' },
      },
    });
  });

  it('accepts the food lever with "Show anyway" and raises the budget by the whole gap', () => {
    const food = choose(['simpler-menu'], ['simpler-menu']);
    if (!food.ok) throw new Error(JSON.stringify(food.refusal));
    expect(food.value.application.closedInr).toBe(54_000);
    const raise = choose(['raise-budget']);
    if (!raise.ok) throw new Error(JSON.stringify(raise.refusal));
    expect(raise.value.application.raisedByInr).toBe(157_000);
    expect(raise.value.line.kind).toBe('on-budget');
    expectPinned('over-budget.food-shown-anyway', food.value);
    expectPinned('over-budget.raise-budget', raise.value);
  });

  it('keeps a raise as the rupees agreed, not a figure re-derived later', () => {
    const raised = viewOf([
      BRIEF_OP,
      ...quoteOps,
      { kind: 'leversApplied', leverIds: ['raise-budget'], raiseBudgetInr: 157_000 },
    ]);
    expect([raised.current.headline.budget.inr, raised.current.headline.gap.inr]).toEqual([
      957_000, 0,
    ]);
    expect(raised.current.money.applied).toEqual([
      { id: 'raise-budget', category: null, effect: { inr: 157_000, provenance: 'your-number' } },
    ]);
  });

  it('pins the plan before and after the quotes', () => {
    expectPinned('over-budget.v1', v1);
    expectPinned('over-budget.v4', v4);
  });
});
