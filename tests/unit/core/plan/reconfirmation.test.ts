import { describe, expect, it } from 'vitest';

import { reconfirmations } from '@/core/plan/reconfirmation';
import type { Op } from '@/schemas/plan/op';

import { QUOTE_A, VENUE_BOOKED, change, first, versionOf, viewOf } from './plan-fixture';

const v5 = versionOf(first(5));

function reasonsAfter(op: Op): [string, readonly string[]][] {
  return reconfirmations(v5, versionOf([...first(5), op])).map((item) => [
    item.vendor.kind === 'quote'
      ? `quote:${item.vendor.quoteId}`
      : `booking:${item.vendor.category}`,
    item.reasons,
  ]);
}

describe('re-confirmation after a change (FR-27)', () => {
  it.each<[string, Op, [string, readonly string[]][]]>([
    [
      'a new date asks every booked or quoted vendor about the date',
      change({ eventDate: '2027-03-05' }),
      [
        ['booking:venue', ['date']],
        ['quote:A', ['date']],
        ['quote:B', ['date']],
      ],
    ],
    [
      'more guests within the venue capacity ask the per-guest quote and the venue booking',
      change({ guests: 210 }),
      [
        ['booking:venue', ['guests']],
        ['quote:A', ['guests']],
      ],
    ],
    [
      'guests above the booked capacity ask the venue about capacity instead',
      change({ guests: 250 }),
      [
        ['booking:venue', ['capacity']],
        ['quote:A', ['guests']],
      ],
    ],
    [
      'guests past a lump sum cap ask that vendor for a new quote',
      change({ guests: 260 }),
      [
        ['booking:venue', ['capacity']],
        ['quote:A', ['guests']],
        ['quote:B', ['cap-exceeded']],
      ],
    ],
    [
      'a priority change asks nobody',
      change({ priorities: { ...v5.priorities, decor: 'standard' } }),
      [],
    ],
    ['a budget change asks nobody', change({ budgetInr: 700_000 }), []],
  ])('%s', (_name, op, expected) => {
    expect(reasonsAfter(op)).toEqual(expected);
  });

  it('asks nothing of categories with no booking and no quote', () => {
    const items = reconfirmations(
      v5,
      versionOf([...first(5), change({ eventDate: '2027-03-05' })]),
    );
    expect(items.map((item) => item.vendor.category)).not.toContain('photo');
  });

  it('does not ask a vendor quoted or booked after the change, who knew the new terms', () => {
    const ops = [first(1)[0], change({ eventDate: '2027-03-05' }), VENUE_BOOKED, QUOTE_A].filter(
      (op): op is Op => op !== undefined,
    );
    expect(viewOf(ops).reconfirmations).toEqual([]);
  });

  it('stops asking the venue once it is booked again after the change', () => {
    const rebooked: Op = { ...VENUE_BOOKED, on: '2026-11-02', capacity: 260 };
    expect(viewOf([...first(6), rebooked]).reconfirmations.map((item) => item.vendor.kind)).toEqual(
      ['quote', 'quote'],
    );
  });

  it('puts the capacity, date and cap questions into the vendor list in data order', () => {
    const view = viewOf([...first(5), change({ guests: 260, eventDate: '2027-02-12' })]);
    const ids = view.vendors.map((vendor) => [
      vendor.label.en,
      vendor.status,
      vendor.questions.map((q) => q.id),
    ]);
    expect(ids).toEqual([
      [
        'Venue (booked)',
        'needs-reconfirmation',
        ['date-reconfirmation', 'venue-capacity', 'step-free-access'],
      ],
      [
        'Caterer A',
        'needs-reconfirmation',
        [
          'tax-rate',
          'rate-above-minimum',
          'date-reconfirmation',
          'guest-count-reconfirmation',
          'step-free-access',
        ],
      ],
      [
        'Caterer B',
        'needs-reconfirmation',
        ['guest-cap-exceeded', 'date-reconfirmation', 'step-free-access'],
      ],
    ]);
    const venue = view.vendors[0]?.questions.find(
      (question) => question.id === 'date-reconfirmation',
    );
    expect(venue?.en).toBe(
      'Our date has changed to 12 Feb 2027. Can you still do it on that day, at the same price?',
    );
    expect(venue?.hi).toContain('12 फ़रवरी 2027');
  });
});
