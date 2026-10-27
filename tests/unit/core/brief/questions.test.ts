import { describe, expect, it } from 'vitest';

import { emptyDraft, type BriefAnswers } from '@/core/brief/brief-draft';
import { resolveBrief } from '@/core/brief/confirm-brief';
import { reasonKey } from '@/core/brief/questions';
import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';

import { asked, CONTEXT, isoDate, settle } from './brief-fixture';

// Today in these tables is 2026-10-31 (the plan fixtures' clock).
type Case = readonly [label: string, answers: BriefAnswers, field: string, reason: string];

describe('budget and guest answers (FR-4)', () => {
  const rejected: readonly Case[] = [
    ['zero guests', { guests: '0' }, 'guests', 'out-of-range'],
    ['negative guests', { guests: '-1' }, 'guests', 'out-of-range'],
    ['negative guests, typographic minus', { guests: '−5' }, 'guests', 'out-of-range'],
    ['too many guests', { guests: '5001' }, 'guests', 'out-of-range'],
    ['fractional guests', { guests: '2.5' }, 'guests', 'not-whole'],
    ['two guest counts', { guests: '100 or 200' }, 'guests', 'several-numbers'],
    ['guests cleared', { guests: '' }, 'guests', 'missing'],
    ['guests null', { guests: null }, 'guests', 'missing'],
    ['zero budget', { budget: '0' }, 'budget', 'out-of-range'],
    ['budget below the floor', { budget: '4999' }, 'budget', 'out-of-range'],
    ['budget with two amounts', { budget: '10 crore 1' }, 'budget', 'several-numbers'],
    ['budget one over the maximum', { budget: '100000001' }, 'budget', 'out-of-range'],
    ['negative budget', { budget: '-8 lakh' }, 'budget', 'out-of-range'],
    ['budget in English words', { budget: 'eight lakh' }, 'budget', 'unreadable'],
    [
      'budget with either of two amounts',
      { budget: '8 lakh ya 9 lakh' },
      'budget',
      'several-numbers',
    ],
    ['budget past fifteen digits', { budget: '9'.repeat(16) }, 'budget', 'out-of-range'],
    ['budget cleared', { budget: '   ' }, 'budget', 'missing'],
  ];
  it.each(rejected)('%s asks again', (_label, answers, field, reason) => {
    expect(asked(settle({}, answers))).toEqual([{ field, reason }]);
  });

  it.each([
    ['8 lakh', 800_000],
    ['Rs 7,50,000', 750_000],
    ['1,90,000/-', 190_000],
    ['dedh lakh', 150_000],
    ['saadhe teen lakh', 350_000],
    ['डेढ़ लाख', 150_000],
    ['dhai lakh', 250_000],
    ['pachaas hazaar', 50_000],
    ['5000', 5_000],
    ['10 crore', 100_000_000],
  ])('reads the budget answer %s as %i', (text, inr) => {
    const result = settle({}, { budget: text });
    expect(result.ok && result.brief.budgetInr).toBe(inr);
  });

  it.each([
    ['150', 150],
    ['dedh hazaar', 1_500],
    ['aath sau', 800],
    ['  200 guests ', 200],
    ['५००', 500],
  ])('reads the guest answer %s as %i', (text, guests) => {
    const result = settle({}, { guests: text });
    expect(result.ok && result.brief.guests).toBe(guests);
  });

  it('shows what was given beside the reason, without pre-filling anything', () => {
    const result = settle({}, { guests: '0' });
    const [question] = result.ok ? [] : result.questions;
    expect(question).toMatchObject({ given: 0, bounds: { min: 1, max: 5_000 } });
    expect(question).not.toHaveProperty('default');
    expect(question).not.toHaveProperty('selected');
  });

  it('lets an answer replace the reading and leaves an absent answer alone', () => {
    expect(settle({ guests: 0 }, { guests: '120' }).ok).toBe(true);
    expect(asked(settle({ guests: 0 }, {}))).toEqual([{ field: 'guests', reason: 'out-of-range' }]);
    expect(asked(settle({ guests: 0 }, { guests: '' }))).toEqual([
      { field: 'guests', reason: 'missing' },
    ]);
  });
});

describe('event date (FR-4, relative-date)', () => {
  it.each([
    ['yesterday', '2026-10-30'],
    ['today', '2026-10-31'],
    ['a past year', '2025-02-26'],
  ])('%s is asked again with the date shown', (_label, date) => {
    const result = settle({ eventDate: date });
    expect(asked(result)).toEqual([{ field: 'eventDate', reason: 'date-passed' }]);
    expect(result.draft.eventDate).toBe(date);
  });

  it.each([
    ['tomorrow', '2026-11-01'],
    ['13 days away', '2026-11-13'],
    ['14 days away', '2026-11-14'],
  ])('%s is a valid date', (_label, date) => {
    const result = settle({ eventDate: date });
    expect(result.ok && result.brief.eventDate).toBe(date);
  });

  it.each([
    ['26/2', '2027-02-26'],
    ['26-02', '2027-02-26'],
    ['31/10', '2027-10-31'],
    ['12/12', '2026-12-12'],
    ['29/2', '2028-02-29'],
    ['26/02/2027', '2027-02-26'],
    ['2027-02-26', '2027-02-26'],
  ])('a null year in "%s" picks the next date after today: %s', (text, date) => {
    const result = settle({}, { eventDate: text });
    expect(result.ok && result.brief.eventDate).toBe(date);
  });

  it.each([
    ['31/4', 'date-invalid'],
    ['30/2/2027', 'date-invalid'],
    ['0/5', 'date-invalid'],
    ['5/13', 'date-invalid'],
    ['26/2/1999', 'date-invalid'],
    ['2101-01-01', 'date-invalid'],
    ['26/2/2026', 'date-passed'],
    ['Feb end mein', 'date-invalid'],
    ['', 'missing'],
  ])('the answer "%s" asks again: %s', (text, reason) => {
    expect(asked(settle({}, { eventDate: text }))).toEqual([{ field: 'eventDate', reason }]);
  });

  it('asks when the reading found no date', () => {
    expect(asked(settle({ eventDate: null }))).toEqual([{ field: 'eventDate', reason: 'missing' }]);
  });

  it('resolves against the date it is given, not the machine clock', () => {
    const later = { ...CONTEXT, today: isoDate('2027-03-01') };
    const result = resolveBrief({ draft: emptyDraft(), answers: { eventDate: '26/2' } }, later);
    expect(result.draft.eventDate).toBe('2028-02-26');
  });
});

describe('occasion (D38)', () => {
  it.each(['wedding', 'birthday', 'anniversary', 'puja', 'communityEvent', 'other'])(
    'accepts %s because the data maps it to a profile',
    (occasion) => {
      expect(settle({}, { occasion }).ok).toBe(true);
    },
  );

  it.each([
    ['not read', null, {}, 'missing'],
    ['cleared', 'wedding', { occasion: '' }, 'missing'],
    ['unclear', null, { occasion: 'unclear' }, 'unreadable'],
    ['unknown', null, { occasion: 'party' }, 'unreadable'],
  ] as const)('an occasion that is %s asks', (_label, kept, answers, reason) => {
    expect(asked(settle({ occasion: kept }, answers))).toEqual([{ field: 'occasion', reason }]);
  });

  it('asks when the data maps the occasion to no profile', () => {
    const weights: BudgetWeightsFile = {
      ...CONTEXT.weights,
      profiles: CONTEXT.weights.profiles.map((profile) => ({
        ...profile,
        occasions: profile.occasions.filter((occasion) => occasion !== 'puja'),
      })),
    };
    const draft = {
      ...emptyDraft(),
      occasion: 'puja',
      budgetInr: 50_000,
      guests: 40,
      eventDate: '2027-02-26',
    } as const;
    const result = resolveBrief({ draft, answers: {} }, { ...CONTEXT, weights });
    expect(asked(result)).toEqual([{ field: 'occasion', reason: 'no-profile' }]);
  });
});

describe('venue capacity and the rows that may stay "not sure"', () => {
  it.each([
    ['0', 'out-of-range'],
    ['10001', 'out-of-range'],
    ['a big hall', 'unreadable'],
  ])('capacity "%s" is asked, never dropped', (text, reason) => {
    expect(asked(settle({}, { venueCapacity: text }))).toEqual([
      { field: 'venueCapacity', reason },
    ]);
  });

  it('lets capacity stay empty', () => {
    const result = settle({}, { venueCapacity: '' });
    expect(result.ok && result.brief.venueCapacity).toBeNull();
  });

  it('applies the rows changed on the check page and keeps the others', () => {
    const result = settle(
      {},
      {
        functions: { sangeet: 'yes' },
        priorities: { catering: 'more' },
        mustHaves: ['dhol'],
        needs: ['elderly'],
        diet: ['jain'],
        venueLimits: ['indoorOnly'],
      },
    );
    expect(result.ok && result.brief).toMatchObject({
      functions: { sangeet: 'yes', haldi: 'unsure' },
      priorities: { catering: 'more', venue: 'unclear' },
      mustHaves: ['dhol'],
      needs: ['elderly'],
      diet: ['jain'],
      venueLimits: ['indoorOnly'],
    });
  });

  it('orders several open questions by field and gives each a reason key', () => {
    const result = settle(
      { occasion: null, eventDate: '2026-01-01' },
      { guests: '0', budget: '1' },
    );
    expect(asked(result).map(({ field }) => field)).toEqual([
      'occasion',
      'budget',
      'guests',
      'eventDate',
    ]);
    const keys = result.ok ? [] : result.questions.map(reasonKey);
    expect(keys).toEqual([
      'brief.question.missing',
      'brief.question.out-of-range',
      'brief.question.out-of-range',
      'brief.question.date-passed',
    ]);
  });
});
