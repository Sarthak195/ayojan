// A small celebration on its own lead times (D40, retimed by D45), replayed offline with today =
// 2026-10-26: the anniversary from the live check (19 Dec 2026, 54 days away), Rs 1,50,000 and 30
// guests, entered through the form. Before D40 every task read Late with "-56 days slack",
// because the celebration profile used the wedding's three-month lead times. D45 shortened the
// celebration counts so a party a week away can still be planned, and made the printed cards and
// the menu tasting wedding-only.
//
// Hand check against data/tasks.yaml before pinning:
//   book-venue: latest finish 19 Dec - 4 = 15 Dec; the caterer (3 days, 1 to do) and the
//     decorator (3 days, 1 to do) must also start by 15 Dec, so 15 Dec; earliest finish 26 Oct
//     + 2 = 28 Oct; slack 48 days.                                                    matches
//   send-invitations: no card to print first, so it can start today; latest finish 19 Dec - 4
//     = 15 Dec; earliest finish 27 Oct; slack 49 days.                                matches
//   No mandap, haldi, sangeet, printed cards or menu tasting; 11 tasks, every one On track.
//                                                                                     matches

import { describe, expect, it } from 'vitest';

import { lateLine } from '@/app/[lang]/p/[token]/_plan/late-line';
import { parseIsoDate, type IsoDate } from '@/core/calendar/day-number';
import { viewOfOps, type PlanView } from '@/core/plan/plan-view';
import type { ScheduledTask } from '@/core/timeline/schedule-types';
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

// The tasks a party cannot happen without: a place, food, guests told and the count to the cook.
const ESSENTIAL = ['book-venue', 'book-caterer', 'send-invitations', 'final-headcount'];

function viewFor(
  occasion: Brief['occasion'],
  eventDate: string,
  mustHaves: Brief['mustHaves'] = [],
): PlanView {
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
    mustHaves,
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

function taskIn(view: PlanView, id: string): ScheduledTask {
  const task = view.current.schedule.tasks.find((each) => each.id === id);
  if (task === undefined) throw new Error(`${id} is not in the plan`);
  return task;
}

describe('a small celebration on its own lead times', () => {
  it('pins the anniversary plan, with every task On track', () => {
    const view = viewFor('anniversary', '2026-12-19');
    expect(view.current.profile).toBe('celebration');
    expect(taskIn(view, 'book-venue')).toMatchObject({
      latestFinish: '2026-12-15',
      slackDays: 48,
      status: 'onTrack',
    });
    expect(statuses(view)).toEqual({ onTrack: 11 });
    expectPinned('celebration.anniversary-v1', view);
  });

  it('shows a birthday six weeks away and a puja three weeks away On track', () => {
    expect(statuses(viewFor('birthday', '2026-12-06'))).toEqual({ onTrack: 11 });
    expect(statuses(viewFor('puja', '2026-11-15'))).toEqual({ onTrack: 11 });
  });

  it('keeps printed cards and a menu tasting off a birthday', () => {
    const ids = viewFor('birthday', '2026-12-06').current.schedule.tasks.map((task) => task.id);
    expect(ids).not.toContain('print-invitations');
    expect(ids).not.toContain('menu-tasting');
    expect(ids).toContain('send-invitations');
  });
});

// D45: "birthday party next Saturday". A week's notice is tight but plannable, so nothing
// essential reads Late; three days is not, and the page says so with what to do about it.
describe('a celebration at short notice', () => {
  it('plans a birthday 7 days away with no Late essential task, At risk at worst', () => {
    const view = viewFor('birthday', '2026-11-02');
    for (const id of ESSENTIAL) expect(taskIn(view, id).status).toBe('atRisk');
    expect(statuses(view)).toEqual({ atRisk: 11 });
  });

  it('plans a birthday 6 days away with no Late task, a choreographer included', () => {
    for (const mustHaves of [
      [],
      ['choreographer'],
      ['mehndiArtist', 'choreographer', 'dhol'],
    ] as const) {
      const view = viewFor('birthday', '2026-11-01', mustHaves);
      expect(statuses(view).late).toBeUndefined();
    }
    expect(
      taskIn(viewFor('birthday', '2026-11-01', ['choreographer']), 'book-choreographer'),
    ).toMatchObject({
      slackDays: 0,
      status: 'atRisk',
    });
  });

  it('shows an anniversary 3 days away Late, saying what is needed and what to do', () => {
    const view = viewFor('anniversary', '2026-10-29');
    const { schedule } = view.current;
    for (const id of ESSENTIAL) expect(taskIn(view, id).status).toBe('late');
    const line = (id: string, lang: 'en' | 'hi'): string =>
      lateLine(taskIn(view, id), schedule, lang);
    // Finish-by 25 Oct is behind today: no "N days left" for a date that has passed.
    expect(line('book-venue', 'en')).toBe('Was due by 25 Oct 2026: start today');
    // Finish-by 27 Oct is still ahead, so the line counts days instead of saying "late".
    expect(line('final-headcount', 'en')).toBe(
      'Needs 4 days from today, 1 day left before 27 Oct 2026: start as soon as "Book the caterer" is done',
    );
    expect(line('return-gifts', 'en')).toBe(
      'Needs 2 days from today, 1 day left before 27 Oct 2026: start today',
    );
    expect(line('book-caterer', 'en')).toContain('none left before 26 Oct 2026');
    expect(line('return-gifts', 'hi')).toBe(
      'आज से 2 दिन चाहिए, 27 अक्टूबर 2026 से पहले 1 दिन बचा: आज ही शुरू करें',
    );
    expect(line('book-venue', 'hi')).toBe('25 अक्टूबर 2026 तक हो जाना था: आज ही शुरू करें');
  });
});
