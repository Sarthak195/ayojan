// A small celebration on its own lead times (D40), replayed offline with today = 2026-10-26:
// the anniversary from the live check (19 Dec 2026, 54 days away), Rs 1,50,000 and 30 guests,
// entered through the form. Before D40 every task read Late with "-56 days slack", because the
// celebration profile used the wedding's three-month lead times.
//
// Hand check against data/tasks.yaml before pinning:
//   book-venue: latest finish 19 Dec - 14 = 5 Dec, but the caterer (12 days, 3 to do) must start
//     by 4 Dec, so 4 Dec; earliest finish 26 Oct + 3 = 29 Oct; slack 36 days.        matches
//   finalise-guest-list: printing (10 days, 4 to do) must start by 5 Dec, so 5 Dec; earliest
//     finish 29 Oct; slack 37 days.                                                   matches
//   No mandap, haldi or sangeet; every task On track.                                 matches

import { describe, expect, it } from 'vitest';

import { parseIsoDate, type IsoDate } from '@/core/calendar/day-number';
import { viewOfOps, type PlanView } from '@/core/plan/plan-view';
import type { Brief } from '@/schemas/plan/brief';
import type { Op } from '@/schemas/plan/op';

import { FORM_READ, HINGLISH_BRIEF, PLAN_DATA } from '../fixtures/plan-readings';
import { expectPinned } from './golden-pin';

function iso(text: string): IsoDate {
  const parsed = parseIsoDate(text);
  if (!parsed.ok) throw new Error(`bad date ${text}`);
  return parsed.value;
}

const TODAY = iso('2026-10-26');

function viewFor(occasion: Brief['occasion'], eventDate: string): PlanView {
  const brief: Brief = {
    ...HINGLISH_BRIEF,
    occasion,
    eventDate,
    budgetInr: 150_000,
    guests: 30,
    functions: {
      haldi: 'unsure',
      mehndi: 'unsure',
      sangeet: 'unsure',
      wedding: 'unsure',
      reception: 'unsure',
    },
    mustHaves: [],
    needs: [],
  };
  const op: Op = { kind: 'briefConfirmed', brief, readBy: FORM_READ };
  const view = viewOfOps([op], PLAN_DATA, TODAY);
  if (!view.ok) throw new Error(`refused: ${JSON.stringify(view.refusal)}`);
  return view.value;
}

function statuses(view: PlanView): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const task of view.current.schedule.tasks) {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
  }
  return counts;
}

describe('a small celebration on its own lead times', () => {
  it('pins the anniversary plan, with every task On track', () => {
    const view = viewFor('anniversary', '2026-12-19');
    expect(view.current.profile).toBe('celebration');
    const venue = view.current.schedule.tasks.find((task) => task.id === 'book-venue');
    expect(venue).toMatchObject({ latestFinish: '2026-12-04', slackDays: 36, status: 'onTrack' });
    expect(statuses(view)).toEqual({ onTrack: 13 });
    expectPinned('celebration.anniversary-v1', view);
  });

  // The dates the matrix found Late: a birthday 41 days away and a puja 20 days away.
  it('shows a birthday six weeks away On track', () => {
    expect(statuses(viewFor('birthday', '2026-12-06'))).toEqual({ onTrack: 13 });
  });

  it('shows a puja three weeks away At risk, not Late', () => {
    expect(statuses(viewFor('puja', '2026-11-15'))).toEqual({ atRisk: 13 });
  });
});
