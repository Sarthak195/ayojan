import { describe, expect, it } from 'vitest';

import type { LeversFile } from '@/schemas/data/levers';

import type { ProjectionInput } from '@/core/budget/projection';
import { applyLevers } from '@/core/levers/lever-application';
import { runningLineSentence } from '@/core/levers/running-line';
import type { SelectionPreview, SelectionRefusal } from '@/core/levers/selection';
import { previewSelection } from '@/core/levers/selection';

import { priorities } from '../budget/draft-data';
import { afterTheChange, context, leverRow, leverRows, overBudget } from './lever-data';

interface Choice {
  readonly selected: readonly string[];
  readonly showAnyway?: readonly string[];
  readonly mustHaves?: Parameters<typeof context>[0];
  readonly priorities?: Parameters<typeof context>[1];
}

function preview(base: ProjectionInput, choice: Choice): SelectionPreview {
  const result = previewSelection({
    ...context(choice.mustHaves ?? ['dhol'], choice.priorities),
    base,
    selected: choice.selected,
    showAnyway: choice.showAnyway ?? [],
  });
  if (!result.ok) throw new Error(`Refused: ${result.refusal.kind}`);
  return result.value;
}

function refusal(base: ProjectionInput, choice: Choice): SelectionRefusal {
  const result = previewSelection({
    ...context(choice.mustHaves ?? ['dhol'], choice.priorities),
    base,
    selected: choice.selected,
    showAnyway: choice.showAnyway ?? [],
  });
  if (result.ok) throw new Error('Expected a refusal');
  return result.refusal;
}

describe('previewSelection on an empty selection', () => {
  const result = preview(overBudget(), { selected: [] });

  it('is not applicable and changes nothing', () => {
    expect(result.canApply).toBe(false);
    expect(result.selected).toEqual([]);
    expect(result.application.projection.projectedTotal.inr).toBe(957_000);
  });

  it('reads as saving nothing and still over by the full gap', () => {
    expect(result.line.kind).toBe('over');
    expect(result.line.saves.inr).toBe(0);
    expect(result.line.remaining.inr).toBe(157_000);
  });
});

describe('previewSelection on the over-budget plan (spec 5.3)', () => {
  it('prices one lever against a copy of the plan', () => {
    const result = preview(overBudget(), { selected: ['simpler-decor'] });
    expect(result.canApply).toBe(true);
    expect(result.application.projection.lines.decor.projected).toEqual({
      inr: 53_000 - 15_900,
      provenance: 'assumption',
    });
    expect(result.line.saves.inr).toBe(15_900);
    expect(result.line.remaining.inr).toBe(141_100);
  });

  it('keeps an exact lever exact', () => {
    const line = preview(overBudget(), { selected: ['half-contingency'] }).application.projection
      .lines.contingency;
    expect(line.projected).toEqual({ inr: 38_000, provenance: 'computed' });
    expect(line.source).toBe('lever');
  });

  it('shows the saving of all four non-priority levers and what is still over', () => {
    const result = preview(overBudget(), {
      selected: ['simpler-decor', 'e-invites', 'leaner-photo', 'half-contingency'],
    });
    // Pinned by hand from the spec: Rs 1,05,100 saved, Rs 51,900 still over.
    expect(result.line.saves.inr).toBe(105_100);
    expect(result.line.kind).toBe('over');
    expect(result.line.remaining.inr).toBe(51_900);
    expect(runningLineSentence(result.line, 'en')).toBe(
      'Selected saves Rs 1,05,100; now Rs 51,900 over budget',
    );
  });

  it('says the remaining choice is the refused lever, a higher budget or fewer guests', () => {
    const result = preview(overBudget(), {
      selected: ['simpler-decor', 'e-invites', 'leaner-photo', 'half-contingency'],
    });
    expect(result.exhausted).toBe(true);
    expect(result.remainingRefused).toEqual(['simpler-menu']);
  });

  it('is not exhausted while an offered lever is left unchosen', () => {
    const result = preview(overBudget(), { selected: ['simpler-decor', 'e-invites'] });
    expect(result.exhausted).toBe(false);
  });

  it('closes the gap when the refused food lever is also chosen with Show anyway', () => {
    const result = preview(overBudget(), {
      selected: ['simpler-decor', 'e-invites', 'leaner-photo', 'half-contingency', 'simpler-menu'],
      showAnyway: ['simpler-menu'],
    });
    expect(result.line.saves.inr).toBe(159_100);
    expect(result.line.kind).toBe('under');
    expect(result.line.remaining.inr).toBe(2_100);
    expect(result.exhausted).toBe(false);
  });

  it('lists the chosen levers in data order whatever order they were ticked in', () => {
    const result = preview(overBudget(), { selected: ['half-contingency', 'simpler-decor'] });
    expect(result.selected).toEqual(['simpler-decor', 'half-contingency']);
  });

  it('ignores a repeated lever id', () => {
    const once = preview(overBudget(), { selected: ['simpler-decor'] });
    const twice = preview(overBudget(), { selected: ['simpler-decor', 'simpler-decor'] });
    expect(twice.line).toEqual(once.line);
  });

  it('switches the invitation task to its faster alternative for e-invites only', () => {
    expect(preview(overBudget(), { selected: ['e-invites'] }).application.fasterTaskIds).toEqual([
      'print-invitations',
    ]);
    expect(
      preview(overBudget(), { selected: ['simpler-decor'] }).application.fasterTaskIds,
    ).toEqual([]);
  });
});

describe('previewSelection on the plan after the change (spec 5.2)', () => {
  it('reaches within budget with e-invites and half the contingency', () => {
    const result = preview(afterTheChange(), { selected: ['e-invites', 'half-contingency'] });
    // Pinned by hand from the spec: saves Rs 64,500 and is then Rs 15,600 under budget.
    expect(result.line.saves.inr).toBe(64_500);
    expect(result.line.kind).toBe('under');
    expect(result.line.remaining.inr).toBe(15_600);
    expect(runningLineSentence(result.line, 'en')).toBe(
      'Selected saves Rs 64,500; now Rs 15,600 under budget',
    );
    expect(result.application.projection.headroom.inr).toBe(15_600);
  });

  it('leaves booked and quoted categories alone', () => {
    const lines = preview(afterTheChange(), { selected: ['e-invites', 'half-contingency'] })
      .application.projection.lines;
    expect(lines.venue.source).toBe('booked');
    expect(lines.catering.source).toBe('quote');
    expect(lines.invites.source).toBe('lever');
  });
});

describe('previewSelection and raising the budget', () => {
  it('raises the budget by the whole gap when chosen alone', () => {
    const result = preview(overBudget(), { selected: ['raise-budget'] });
    expect(result.application.budgetNowInr).toBe(957_000);
    expect(result.application.raisedByInr).toBe(157_000);
    expect(result.line).toMatchObject({ kind: 'on-budget', remaining: { inr: 0 } });
    expect(runningLineSentence(result.line, 'en')).toBe(
      'Selected saves Rs 1,57,000; now exactly on budget',
    );
  });

  it('raises it only by what the other chosen levers leave over', () => {
    const result = preview(overBudget(), { selected: ['simpler-decor', 'raise-budget'] });
    expect(result.application.raisedByInr).toBe(141_100);
    expect(result.line.saves.inr).toBe(157_000);
    expect(result.line.kind).toBe('on-budget');
  });

  it('raises the budget by nothing when the other levers already close the gap', () => {
    const result = preview(afterTheChange(), {
      selected: ['e-invites', 'half-contingency', 'raise-budget'],
    });
    expect(result.application.raisedByInr).toBe(0);
    expect(result.line.kind).toBe('under');
  });
});

describe('previewSelection refusals', () => {
  it('refuses the refused food lever without Show anyway', () => {
    expect(refusal(overBudget(), { selected: ['simpler-menu'] })).toEqual({
      kind: 'lever-refused',
      id: 'simpler-menu',
      reason: { kind: 'invest-more', category: 'catering' },
    });
  });

  it('accepts the refused lever once Show anyway is ticked for it', () => {
    const result = preview(overBudget(), {
      selected: ['simpler-menu'],
      showAnyway: ['simpler-menu'],
    });
    expect(result.line.saves.inr).toBe(54_000);
  });

  it('does not let a Show anyway for another lever unlock this one', () => {
    expect(
      refusal(overBudget(), { selected: ['simpler-menu'], showAnyway: ['simpler-decor'] }).kind,
    ).toBe('lever-refused');
  });

  it('refuses a disabled lever even with Show anyway', () => {
    expect(
      refusal(overBudget(), { selected: ['smaller-band'], showAnyway: ['smaller-band'] }),
    ).toEqual({
      kind: 'lever-disabled',
      id: 'smaller-band',
      reason: { kind: 'must-have', mustHave: 'dhol' },
    });
  });

  it('refuses a lever on a booked category', () => {
    const input = overBudget();
    const booked = { ...input, evidence: { ...input.evidence, decor: { bookedInr: 60_000 } } };
    expect(refusal(booked, { selected: ['simpler-decor'] })).toMatchObject({
      kind: 'lever-not-applicable',
      reason: { kind: 'booked', category: 'decor' },
    });
  });

  it('refuses a booked invest-more lever even with Show anyway', () => {
    const input = overBudget();
    const booked = { ...input, evidence: { ...input.evidence, catering: { bookedInr: 400_000 } } };
    expect(refusal(booked, { selected: ['simpler-menu'], showAnyway: ['simpler-menu'] }).kind).toBe(
      'lever-refused',
    );
  });

  it('refuses an id that is not in the data', () => {
    expect(refusal(overBudget(), { selected: ['cheaper-quote'] })).toEqual({
      kind: 'unknown-lever',
      id: 'cheaper-quote',
    });
  });

  it('refuses every lever for a plan within budget, because none is on offer', () => {
    const within = { ...overBudget(), budgetNowInr: 1_000_000 };
    expect(refusal(within, { selected: ['simpler-decor'] })).toEqual({
      kind: 'not-offered',
      id: 'simpler-decor',
    });
    expect(preview(within, { selected: [] }).canApply).toBe(false);
  });

  it('passes a budget refusal on as a typed reason', () => {
    expect(refusal({ ...overBudget(), guestsNow: 0 }, { selected: [] })).toEqual({
      kind: 'budget',
      reason: 'guests-out-of-range',
    });
  });

  it('turns the food lever offered again after a priority revision to standard (D13)', () => {
    const standard = priorities({ decor: 'save' });
    const result = preview(overBudget(), { selected: ['simpler-menu'], priorities: standard });
    expect(result.line.saves.inr).toBe(54_000);
  });
});

describe('previewSelection recomputes instead of summing', () => {
  // Two percent levers on one category in the data would take 30 percent of what is left, not
  // 30 percent twice of the original, so the saving is less than the sum of the two options.
  const twice: LeversFile['levers'] = [
    leverRow('simpler-decor'),
    { ...leverRow('simpler-decor'), id: 'plainer-decor' },
  ];

  it('applies two levers on one category one after the other', () => {
    const result = applyLevers({
      base: overBudget(),
      levers: twice,
      selected: ['simpler-decor', 'plainer-decor'],
    });
    if (!result.ok) throw new Error(result.reason);
    // 53,000 less 30 percent is 37,100; less 30 percent of that is 25,970.
    expect(result.value.projection.lines.decor.projected.inr).toBe(25_970);
    expect(result.value.closedInr).toBe(27_030);
  });

  it('never reads a total from the client: the preview depends only on the plan and ids', () => {
    const first = previewSelection({
      ...context(['dhol']),
      base: overBudget(),
      selected: ['e-invites'],
      showAnyway: [],
    });
    const second = previewSelection({
      ...context(['dhol']),
      base: overBudget(),
      selected: ['e-invites'],
      showAnyway: [],
    });
    expect(first).toEqual(second);
  });

  it('ignores lever evidence already present in the input, so nothing counts twice', () => {
    const input = overBudget();
    const stale = {
      ...input,
      evidence: { ...input.evidence, decor: { lever: { projectedInr: 1, exact: true } } },
    };
    const result = preview(stale, { selected: ['simpler-decor'] });
    expect(result.application.projection.lines.decor.projected.inr).toBe(37_100);
  });
});

describe('applyLevers on a plan whose situation changed after the levers were chosen', () => {
  it('skips a lever whose category was booked since, so the real booking stands', () => {
    const input = overBudget();
    const booked = { ...input, evidence: { ...input.evidence, decor: { bookedInr: 60_000 } } };
    const result = applyLevers({ base: booked, levers: leverRows, selected: ['simpler-decor'] });
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.skipped).toEqual([{ id: 'simpler-decor', reason: 'booked' }]);
    expect(result.value.projection.lines.decor.projected.inr).toBe(60_000);
  });

  it('keeps a lever on an invest-more category that was chosen before the priority changed', () => {
    const result = applyLevers({
      base: overBudget(),
      levers: leverRows,
      selected: ['simpler-menu'],
    });
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.projection.lines.catering.projected.inr).toBe(306_000);
  });

  it('reports an id that has left the data as skipped, not as an error', () => {
    const result = applyLevers({ base: overBudget(), levers: leverRows, selected: ['gone'] });
    expect(result.ok && result.value.skipped).toEqual([{ id: 'gone', reason: 'unknown' }]);
  });
});

describe('runningLineSentence', () => {
  it('words an under-budget line and a Hindi line with the same numbers', () => {
    const under = preview(afterTheChange(), { selected: ['e-invites', 'half-contingency'] }).line;
    const hindi = runningLineSentence(under, 'hi');
    expect(hindi).toContain('64,500');
    expect(hindi).toContain('15,600');
    expect(hindi).toMatch(/[ऀ-ॿ]/);
  });
});
