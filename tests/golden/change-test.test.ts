// The change test (spec 5.2, FR-23 to FR-30), replayed offline from hand-made readings with
// today = 2026-10-31. Every step goes through the same core paths a route uses (markDone and
// delayTask for the task form, changeValuesFrom, changeQuestions and confirmChange for the
// change reading, previewSelection for the levers), and each version's whole PlanView is
// deep-equal to the JSON pinned under tests/golden/plans.
//
// Hand check against the spec's design-time values, done before the views were pinned:
//   v1  projected Rs 8,00,000 (at budget by construction); Book venue latest finish 2026-11-18,
//       earliest finish 2026-11-10, slack 8, At risk, on the critical path.          matches
//   v3  the delay is stored as notBefore 2026-11-10; Decor sign-off, Mandap design and Final
//       walkthrough move 10 days later and stay On track (slack 61, 63, 76).          matches
//   v5  catering from Caterer A at Rs 2,60,000 plus GST, rate not stated; projected
//       Rs 7,43,000; "B becomes cheaper from 231 guests, before A's GST".             matches
//   v6  guests 250, budget Rs 7,50,000 (answered "By how much?"), date 2027-02-12; catering
//       ranking flips to B at Rs 3,00,000; decor Rs 55,650; invitations Rs 66,250; projected
//       Rs 7,98,900, over by Rs 48,900; venue 250 against a booked 220; Book caterer slack
//       18 to 4 (At risk); Print invitations 23 to 9 (At risk); Book decorator 23 to 9.  matches
//   v7  e-invites Rs 26,500 plus half the contingency Rs 38,000: "Selected saves Rs 64,500;
//       now Rs 15,600 under budget"; Print invitations is no longer At risk.            matches
//   v8  Move Rs 40,000 to photo: Rs 15,600 from headroom, Rs 24,400 from decor (53,000 to
//       28,600, above its 26,500 floor); projected Rs 7,48,780; simpler menu offered.  matches
//   Undo of v8 equals v7.                                                              matches
//
// Divergences from the spec's prose, each kept on purpose:
//   1. v2 (venue booked at Rs 1,80,000, no quotes yet) is over budget by Rs 14,000, because the
//      booking is above the venue's Rs 1,66,000 split. The spec does not show v2; the plan goes
//      back under budget once Caterer A's quote replaces the catering split in v5.
//   2. After the change, Book photographer (slack 21 to 7) and Finalise guest list (23 to 9) also
//      turn At risk. The spec lists only the tasks it tours; the scheduler reports every task
//      whose slack crosses 14, and both use the same rule as Book caterer.
//   3. Caterer B is re-confirmed for the date only, not the guest count: it is a lump sum within
//      its 250 cap, and the architecture (4.8) asks the guest question of per-plate quotes and
//      bookings only. The spec's "both caterers confirm plates for 250" is the prose version.
//      Both quotes still land in "Kept, ask again", as FR-26 says.
//   4. The venue is asked the capacity question (250 against 220) and the date question, not
//      the guest-count question as well: the capacity question already names the new count.
//   5. The Hinglish Rs 50,000 move leaves a Move-money shortfall of Rs 7,900 (50,000 minus
//      15,600 headroom minus decor's 26,500 down to its floor), but the plan shows Rs 6,575
//      over budget, because decor's lower allocation also lowers its guest-scaled projection
//      (x 1.05 at 250 guests). The shortfall is what Move money could not find; the gap is what
//      the plan header shows as over budget.

import { describe, expect, it } from 'vitest';

import { parseIsoDate, type IsoDate } from '@/core/calendar/day-number';
import { confirmChange } from '@/core/plan/change-answers';
import { changeQuestions, changeValuesFrom } from '@/core/plan/change-questions';
import { undo } from '@/core/plan/fold';
import { viewOfOps, type PlanView } from '@/core/plan/plan-view';
import { previewSelection } from '@/core/levers/selection';
import { breakEvenSentence, quoteLabel } from '@/core/quotes/quote-wording';
import { runningLineSentence } from '@/core/levers/running-line';
import { delayTask, markDone } from '@/core/timeline/task-progress';
import { resolveTask } from '@/core/timeline/task-selection';
import type { Op } from '@/schemas/plan/op';
import { toShortText } from '@/schemas/plan/short-text';
import type { ChangeReading } from '@/schemas/readings/change-reading';

import {
  AI_READ,
  BRIEF_OP,
  CATERER_A,
  CATERER_B,
  EXPLAINER_READING,
  FORM_READ,
  HINGLISH_REALLOCATION,
  PLAN_DATA,
  SPEC_PRIORITIES,
  TODAY,
} from '../fixtures/plan-readings';
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

function task(view: PlanView, id: string): PlanView['current']['schedule']['tasks'][number] {
  const found = view.current.schedule.tasks.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no task ${id}`);
  return found;
}

function line(view: PlanView, category: 'venue' | 'catering' | 'decor' | 'photo' | 'invites') {
  return view.current.money.projection.lines[category];
}

function changeOp(reading: ChangeReading, view: PlanView, budgetAnswer: number | null): Op {
  const { headline } = view.current;
  const current = {
    guests: headline.guests,
    budgetInr: headline.budget.inr,
    eventDate: headline.eventDate,
  };
  const { values } = changeValuesFrom(reading, current, today);
  const confirmed = confirmChange(
    values,
    { budgetInr: budgetAnswer, eventDate: null },
    current,
    today,
  );
  if (!confirmed.ok) throw new Error(`open questions: ${JSON.stringify(confirmed.open)}`);
  const sources = [reading.guests, reading.budget, reading.dateShift, reading.reallocate]
    .map((field) => field.quote)
    .filter((quote) => quote.length > 0)
    .map(toShortText);
  return {
    kind: 'changeConfirmed',
    ...confirmed.fields,
    priorities: null,
    sources,
    readBy: AI_READ,
  };
}

// The sequence is built once, step by step, the way the routes would build it.
const ops: Op[] = [BRIEF_OP];
const views: PlanView[] = [viewOf(ops)];

function push(op: Op): PlanView {
  ops.push(op);
  const view = viewOf(ops);
  views.push(view);
  return view;
}

const venueTasks = views[0]?.current.schedule.tasks ?? [];
const booked = markDone(
  { taskId: 'book-venue', on: today, amountInr: 180_000, capacity: 220 },
  PLAN_DATA.tasks.tasks
    .filter((row) => venueTasks.some((t) => t.id === row.id))
    .map((row) => resolveTask(row, false)),
);
if (!booked.ok) throw new Error(booked.reason);
const v2 = push({
  kind: 'taskDone',
  taskId: 'book-venue',
  on: TODAY,
  amountInr: 180_000,
  capacity: 220,
});
const delay = delayTask(v2.current.schedule, 'book-decorator', 10);
if (!delay.ok) throw new Error(delay.reason);
push({ kind: 'taskDelayed', taskId: 'book-decorator', notBefore: delay.record.notBefore });
push({ kind: 'quoteAdded', quote: CATERER_A, readBy: AI_READ });
const v5 = push({ kind: 'quoteAdded', quote: CATERER_B, readBy: AI_READ });
const explainerOp = changeOp(EXPLAINER_READING, v5, 750_000);
const v6 = push(explainerOp);
const leverChoice = previewSelection({
  levers: PLAN_DATA.levers.levers,
  priorities: v6.current.priorities,
  mustHaves: v6.current.brief.mustHaves,
  base: v6.current.money.input,
  selected: ['e-invites', 'half-contingency'],
  showAnyway: [],
});
if (!leverChoice.ok) throw new Error(JSON.stringify(leverChoice.refusal));
const v7 = push({
  kind: 'leversApplied',
  leverIds: ['e-invites', 'half-contingency'],
  raiseBudgetInr: null,
});
const formChange: Op = {
  kind: 'changeConfirmed',
  guests: null,
  budgetInr: null,
  eventDate: null,
  reallocate: { to: 'photo', amountInr: 40_000 },
  priorities: { ...SPEC_PRIORITIES, catering: 'standard' },
  sources: [],
  readBy: FORM_READ,
};
const v8 = push(formChange);

describe('the change test (spec 5.2)', () => {
  it('starts at budget with Book venue At risk on the critical path', () => {
    const v1 = views[0];
    if (v1 === undefined) throw new Error('no v1');
    expect(v1.current.headline.projected.inr).toBe(800_000);
    expect(v1.current.headline.status).toBe('within-budget');
    const venue = task(v1, 'book-venue');
    expect([venue.latestFinish, venue.earliestFinish, venue.slackDays]).toEqual([
      '2026-11-18',
      '2026-11-10',
      8,
    ]);
    expect([venue.status, venue.onCriticalPath]).toEqual(['atRisk', true]);
  });

  it('books the venue at the family number, with its capacity overriding the brief', () => {
    expect(line(v2, 'venue').projected).toEqual({ inr: 180_000, provenance: 'your-number' });
    expect(v2.current.headline.venue).toEqual({ capacity: 220, source: 'booking' });
    expect(task(v2, 'confirm-step-free-access').done).toBe(false);
  });

  it('stores the decorator delay as a date and lists the three dependants it moved', () => {
    expect(delay.record.notBefore).toBe('2026-11-10');
    const effect = views[2]?.current.delayEffects[0];
    expect(effect?.dependants.map((d) => [d.taskId, d.movedDays, d.status])).toEqual([
      ['decor-sign-off', 10, 'onTrack'],
      ['mandap-design', 10, 'onTrack'],
      ['final-walkthrough', 10, 'onTrack'],
    ]);
  });

  it('projects Caterer A plus GST and finds Caterer B cheaper from 231 guests', () => {
    expect(line(v5, 'catering').projected).toEqual({ inr: 260_000, provenance: 'from-quote' });
    expect(line(v5, 'catering').note).toBe('plus-gst-rate-not-stated');
    expect(v5.current.headline.projected.inr).toBe(743_000);
    const breakEven = v5.current.comparisons[0]?.breakEvens[0];
    if (breakEven === undefined) throw new Error('no break-even');
    const label = (slot: 'A' | 'B'): string => quoteLabel({ category: 'catering', id: slot }, 'en');
    expect(breakEvenSentence(breakEven, label, 'en').headline).toBe(
      "Caterer B becomes cheaper from 231 guests, before Caterer A's GST.",
    );
  });

  it('asks "By how much?" for the explainer budget with nothing pre-selected', () => {
    const current = { guests: 200, budgetInr: 800_000, eventDate: v5.current.headline.eventDate };
    const { values } = changeValuesFrom(EXPLAINER_READING, current, today);
    expect(values.guests).toEqual({ mode: 'delta', count: 50 });
    expect(values.dateCandidates).toEqual(['2027-02-12']);
    expect(changeQuestions(values, current, today)).toEqual([
      {
        kind: 'budget-how-much',
        direction: 'decrease',
        options: [
          { percent: 5, budgetInr: 760_000 },
          { percent: 10, budgetInr: 720_000 },
        ],
        selected: null,
      },
    ]);
    expect(confirmChange(values, { budgetInr: null, eventDate: null }, current, today).ok).toBe(
      false,
    );
  });

  it('revises in place: one op, the split frozen, over budget by Rs 48,900', () => {
    expect(ops.filter((op) => op.kind === 'changeConfirmed')).toHaveLength(2);
    const { headline, money } = v6.current;
    expect([headline.guests, headline.budget.inr, headline.eventDate]).toEqual([
      250,
      750_000,
      '2027-02-12',
    ]);
    expect(money.projection.lines.catering.projected.inr).toBe(300_000);
    expect(money.projection.lines.decor.projected.inr).toBe(55_650);
    expect(money.projection.lines.invites.projected.inr).toBe(66_250);
    expect([headline.projected.inr, headline.gap.inr]).toEqual([798_900, 48_900]);
    expect(money.projection.lines.decor.allocation.inr).toBe(53_000);
    expect([task(v6, 'book-caterer').slackDays, task(v6, 'book-caterer').status]).toEqual([
      4,
      'atRisk',
    ]);
    expect([task(v6, 'print-invitations').slackDays, task(v6, 'print-invitations').status]).toEqual(
      [9, 'atRisk'],
    );
    expect(task(v6, 'book-decorator').slackDays).toBe(9);
  });

  it('shows the diff with reason codes, the Kept counter and the re-confirmations', () => {
    const revision = v6.revision;
    if (revision === null) throw new Error('no revision');
    expect([revision.beforeVersion, revision.afterVersion]).toEqual([5, 6]);
    const ranking = revision.rows.find((row) => row.kind === 'ranking');
    expect(ranking).toEqual({
      kind: 'ranking',
      category: 'catering',
      before: 'A',
      after: 'B',
      crossedAtGuests: 231,
      reason: 'ranking-flipped',
    });
    expect(revision.rows.find((row) => row.kind === 'venueFit')).toEqual({
      kind: 'venueFit',
      capacity: 220,
      before: 200,
      after: 250,
      fitsAfter: false,
      reason: 'guests-changed',
    });
    const caterer = revision.rows.find(
      (row) => row.kind === 'task' && row.taskId === 'book-caterer',
    );
    expect(caterer).toMatchObject({
      before: { slackDays: 18 },
      after: { slackDays: 4, status: 'atRisk' },
      reason: 'event-date-moved',
    });
    expect(revision.kept.keptAskAgain.map((item) => item.key)).toEqual([
      'booking:venue',
      'quote:A',
      'quote:B',
    ]);
    expect(revision.kept.kept.map((item) => item.key)).toEqual(
      expect.arrayContaining([
        'priority:catering',
        'mustHave:dhol',
        'need:wheelchair',
        'function:haldi',
        'taskEvent:book-decorator',
      ]),
    );
    expect(revision.kept.counter).toEqual({
      kept: revision.kept.kept.length + 3,
      total: revision.kept.kept.length + 3,
    });
    expect(v6.reconfirmations.map((item) => [item.vendor.kind, item.reasons])).toEqual([
      ['booking', ['date', 'capacity']],
      ['quote', ['date', 'guests']],
      ['quote', ['date']],
    ]);
    const venueQuestions = v6.vendors[0]?.questions.map((question) => question.en);
    expect(venueQuestions).toContain(
      'Guests are now 250 and you booked for 220. Can the venue take 250, and at what rate?',
    );
  });

  it('applies the chosen levers: saves Rs 64,500 and clears Print invitations', () => {
    expect(runningLineSentence(leverChoice.value.line, 'en')).toBe(
      'Selected saves Rs 64,500; now Rs 15,600 under budget',
    );
    expect(v7.current.headline.gap.inr).toBe(-15_600);
    expect(task(v7, 'print-invitations').status).toBe('onTrack');
    expect(task(v7, 'print-invitations').fasterApplied).toBe(true);
    expect(v7.revision?.afterVersion).toBe(6);
  });

  it('moves Rs 40,000 to photo from headroom then decor, and offers the simpler menu', () => {
    const move = v8.current.money.moves[0]?.outcome;
    expect(move?.fromHeadroom.inr).toBe(15_600);
    expect(move?.givers.map((giver) => [giver.category, giver.amount.inr])).toEqual([
      ['decor', 24_400],
    ]);
    expect(move?.shortfall.inr).toBe(0);
    expect(line(v8, 'decor').allocation.inr).toBe(28_600);
    expect(line(v8, 'photo').allocation.inr).toBe(116_000);
    expect(v8.current.headline.projected.inr).toBe(748_780);
    expect(v8.current.money.options.find((option) => option.id === 'simpler-menu')?.status).toBe(
      'offered',
    );
    expect(v8.revision?.kept.changed.map((item) => item.key)).toEqual(['priority:catering']);
  });

  it('undoes the last step back to exactly the previous plan', () => {
    const undone = undo(ops);
    if (!undone.ok) throw new Error(undone.reason);
    expect(undone.ops).toStrictEqual(ops.slice(0, 7));
    expect(viewOf(undone.ops)).toStrictEqual(v7);
  });

  it('pins every version of the change test', () => {
    for (const [index, view] of views.entries())
      expectPinned(`change-test.v${String(index + 1)}`, view);
  });
});

describe('the change test through the form twin (FR-30)', () => {
  it('gives the same plan except how the change was read', () => {
    const formOps: Op[] = [...ops.slice(0, 5), { ...explainerOp, sources: [], readBy: FORM_READ }];
    const viaForm = viewOf(formOps);
    const strip = (view: PlanView): unknown => ({ ...view, ledger: view.ledger.slice(1) });
    expect(strip(viaForm)).toStrictEqual(strip(v6));
    expect(viaForm.ledger[0]?.readBy).toEqual(FORM_READ);
    expect(viaForm.ledger[0]?.en).toBe(v6.ledger[0]?.en);
  });
});

describe('the Hinglish Rs 50,000 move after the levers (FR-28)', () => {
  it('shows what the givers could not cover as over budget and cuts nothing silently', () => {
    const op = changeOp(HINGLISH_REALLOCATION, v7, null);
    const view = viewOf([...ops.slice(0, 7), op]);
    const move = view.current.money.moves[0]?.outcome;
    expect(move?.fromHeadroom.inr).toBe(15_600);
    expect(move?.givers.map((giver) => [giver.category, giver.amount.inr])).toEqual([
      ['decor', 26_500],
    ]);
    expect(move?.shortfall.inr).toBe(7_900);
    expect(view.current.headline.gap.inr).toBe(6_575);
    expectPinned('change-test.reallocate-shortfall', view);
  });
});
