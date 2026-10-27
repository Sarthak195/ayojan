import { describe, expect, it } from 'vitest';

import type { Brief } from '@/schemas/plan/brief';

import { briefOp, change, first, isoDate, SPEC_OPS, VENUE_BOOKED, viewOf } from './plan-fixture';

const ALL_STANDARD: Brief['priorities'] = {
  venue: 'standard',
  catering: 'standard',
  decor: 'standard',
  photo: 'standard',
  music: 'standard',
  invites: 'standard',
  contingency: 'standard',
};

const NO_FUNCTIONS: Brief['functions'] = {
  haldi: 'no',
  mehndi: 'no',
  sangeet: 'no',
  wedding: 'no',
  reception: 'no',
};

describe('plan view: five different briefs (NFR-ALN-6)', () => {
  it.each<[string, Partial<Brief>, 'wedding' | 'celebration', boolean]>([
    ['the Hinglish wedding of spec 5.1', {}, 'wedding', true],
    [
      'an English wedding at 12 lakh',
      { budgetInr: 1_200_000, guests: 350, priorities: ALL_STANDARD },
      'wedding',
      true,
    ],
    [
      'Papa ka 60th birthday, 2 lakh, 80 guests',
      {
        occasion: 'birthday',
        budgetInr: 200_000,
        guests: 80,
        eventDate: '2026-12-12',
        functions: NO_FUNCTIONS,
        mustHaves: [],
        needs: [],
      },
      'celebration',
      false,
    ],
    [
      'a Rs 10,000 kids birthday for 25 children',
      {
        occasion: 'birthday',
        budgetInr: 10_000,
        guests: 25,
        eventDate: '2026-12-20',
        functions: NO_FUNCTIONS,
        mustHaves: [],
        needs: ['children'],
      },
      'celebration',
      false,
    ],
    [
      'a puja for 40 with elders',
      {
        occasion: 'puja',
        budgetInr: 60_000,
        guests: 40,
        eventDate: '2027-01-14',
        functions: NO_FUNCTIONS,
        mustHaves: [],
        needs: ['elderly'],
      },
      'celebration',
      false,
    ],
  ])('plans %s at budget with the %s profile', (_name, changes, profile, hasMandap) => {
    const view = viewOf([briefOp(changes)]);
    const { current } = view;
    expect(current.profile).toBe(profile);
    expect(current.headline.projected.inr).toBe(current.headline.budget.inr);
    expect(current.headline.status).toBe('not-priced');
    expect(current.schedule.tasks.some((task) => task.id === 'mandap-design')).toBe(hasMandap);
    expect(view.banners.some((banner) => banner.kind === 'small-celebration-profile')).toBe(
      profile === 'celebration',
    );
    expect(view.revision).toBeNull();
    expect(view.messageFacts.before).toBeNull();
  });
});

describe('plan view: banners', () => {
  it('flags an event under 14 days away and still computes it, with most tasks late', () => {
    const view = viewOf([briefOp({ eventDate: '2026-11-10' })]);
    expect(view.banners).toContainEqual({ kind: 'short-notice', daysToEvent: 10 });
    const late = view.current.schedule.tasks.filter((task) => task.status === 'late');
    expect(late.length).toBeGreaterThan(view.current.schedule.tasks.length / 2);
  });

  it('flags a plan over budget with the gap', () => {
    expect(viewOf(first(2)).banners).toEqual([{ kind: 'over-budget', gapInr: 14_000 }]);
  });
});

describe('plan view: what it shows and what it never uses', () => {
  it('shows noted items as display text only: they never move a number', () => {
    const plain = viewOf([briefOp()]);
    const noted = viewOf([briefOp({ notes: ['DJ chahiye', 'nut allergy'] })]);
    expect(noted.current.brief.notes).toEqual(['DJ chahiye', 'nut allergy']);
    expect(noted.current.money).toStrictEqual(plain.current.money);
    expect(noted.current.schedule).toStrictEqual(plain.current.schedule);
  });

  it('gives the same view for the same ops and today, and a later today moves only time', () => {
    expect(viewOf(SPEC_OPS)).toStrictEqual(viewOf(SPEC_OPS));
    const later = viewOf(first(3), isoDate('2026-11-03'));
    const now = viewOf(first(3));
    expect(later.current.money).toStrictEqual(now.current.money);
    const decorator = (view: typeof now): string | undefined =>
      view.current.schedule.tasks.find((task) => task.id === 'book-decorator')?.earliestStart;
    // The delay is a stored date (D11): viewed three days later the decorator still starts 10 Nov.
    expect([decorator(now), decorator(later)]).toEqual(['2026-11-10', '2026-11-10']);
  });

  it('feeds the messages module the headline before the latest change (D32)', () => {
    const view = viewOf(SPEC_OPS);
    expect(view.messageFacts.before).toEqual({
      budgetInr: 750_000,
      guests: 250,
      eventDate: '2027-02-12',
      projectedInr: 734_400,
    });
    expect(view.messageFacts.now.projectedInr).toBe(748_780);
    expect(view.messageFacts.levers.map((lever) => [lever.id, lever.effectInr])).toEqual([
      ['e-invites', 26_500],
      ['half-contingency', 38_000],
    ]);
  });

  it('keeps every input the change did not touch (FR-25)', () => {
    const before = viewOf(first(5)).current;
    const after = viewOf(first(6)).current;
    expect(after.brief).toStrictEqual(before.brief);
    expect(after.priorities).toStrictEqual(before.priorities);
    expect(after.bookings).toStrictEqual(before.bookings);
    expect(after.quotes).toStrictEqual(before.quotes);
    expect(after.money.input.split).toStrictEqual(before.money.input.split);
    expect(after.schedule.tasks.find((task) => task.id === 'book-decorator')?.notBefore).toBe(
      '2026-11-10',
    );
  });

  it('folds and views 40 ops in under 50 ms', () => {
    const ops = [
      ...SPEC_OPS,
      ...Array.from({ length: 31 }, () => VENUE_BOOKED),
      change({ guests: 240 }),
    ];
    expect(ops).toHaveLength(40);
    viewOf(ops);
    const started = performance.now();
    viewOf(ops);
    expect(performance.now() - started).toBeLessThan(50);
  });
});
