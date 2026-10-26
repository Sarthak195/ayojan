import { describe, expect, it } from 'vitest';

import type { QuoteRecord } from '@/schemas/plan/quote-record';

import type { QuestionPlan, QuestionSubject } from '@/core/quotes/vendor-questions';
import { vendorQuestions } from '@/core/quotes/vendor-questions';

import { CATERER_A, CATERER_B, NO_NEEDS, questionRows, quote, totalOf } from './quote-data';

const QUIET_PLAN: QuestionPlan = {
  mustHaves: [],
  needs: [],
  diet: [],
  venueLimits: [],
  reconfirm: [],
  values: { guests: 200, capacity: null, date: null },
};

function plan(overrides: Partial<QuestionPlan> = {}): QuestionPlan {
  return { ...QUIET_PLAN, ...overrides };
}

function subjectFor(record: QuoteRecord, guests = 200): QuestionSubject {
  return { category: record.category, quote: record, total: totalOf(record, guests, NO_NEEDS) };
}

function idsFor(subject: QuestionSubject, forPlan: QuestionPlan): string[] {
  return vendorQuestions(questionRows, subject, forPlan).map((question) => question.id);
}

describe('vendorQuestions for the spec Caterer A', () => {
  it('asks the GST rate and the rate above 200 plates, and nothing else, with no needs', () => {
    expect(idsFor(subjectFor(CATERER_A), plan())).toEqual(['tax-rate', 'rate-above-minimum']);
  });

  it('adds step-free access and a Jain menu for a wheelchair guest and a Jain diet', () => {
    expect(idsFor(subjectFor(CATERER_A), plan({ needs: ['wheelchair'], diet: ['jain'] }))).toEqual([
      'tax-rate',
      'rate-above-minimum',
      'step-free-access',
      'jain-menu',
    ]);
  });

  it('asks nothing about the GST of Caterer B, whose tax is included', () => {
    expect(idsFor(subjectFor(CATERER_B), plan())).toEqual([]);
  });

  it('renders each question in English and Hindi from the data', () => {
    const [first] = vendorQuestions(questionRows, subjectFor(CATERER_A), plan());
    const row = questionRows.find((candidate) => candidate.id === 'tax-rate');
    expect(first?.en).toBe(row?.en);
    expect(first?.hi).toBe(row?.hi);
    expect(first?.hi).toMatch(/[ऀ-ॿ]/);
  });
});

describe('vendorQuestions for each unclear field', () => {
  const rows: readonly [string, Partial<QuoteRecord>, string][] = [
    ['an unclear tax rate', { tax: 'unclear' }, 'tax-rate'],
    ['a missing minimum', { minimumGuests: null }, 'minimum-guarantee'],
    ['a rate above the minimum', { minimumGuests: 100 }, 'rate-above-minimum'],
    [
      'a lump sum with no stated cover',
      { basis: 'lumpSum', rateInr: 90_000, guestsCovered: null },
      'guests-covered',
    ],
    ['a per-day quote', { basis: 'perDay' }, 'days-for-per-day'],
  ];

  it.each(rows)('asks for %s', (_name, overrides, id) => {
    expect(idsFor(subjectFor(quote(overrides)), plan())).toContain(id);
  });

  it('asks no field question when nothing is unclear', () => {
    const clear = quote({ minimumGuests: 0, tax: 'included' });
    expect(idsFor(subjectFor(clear), plan())).toEqual([]);
  });
});

describe('vendorQuestions when a lump sum is over its cap', () => {
  const subject = subjectFor(CATERER_B, 260);

  it('asks for a revised quote and fills in the guest count in both languages', () => {
    const [question] = vendorQuestions(
      questionRows,
      subject,
      plan({ values: { guests: 260, capacity: null, date: null } }),
    );
    expect(question?.id).toBe('guest-cap-exceeded');
    expect(question?.en).toContain('260');
    expect(question?.hi).toContain('260');
    expect(question?.en).not.toContain('{');
    expect(question?.hi).not.toContain('{');
  });
});

describe('vendorQuestions for the plan', () => {
  it('asks the live counter question only when it is a must-have the quote does not price', () => {
    const asked = plan({ mustHaves: ['liveCounter'] });
    expect(idsFor(subjectFor(CATERER_A), asked)).not.toContain('live-counter-included');
    expect(idsFor(subjectFor(quote({ tax: 'included' })), asked)).toContain(
      'live-counter-included',
    );
    expect(idsFor(subjectFor(CATERER_A), plan())).not.toContain('live-counter-included');
  });

  it('asks the dhol and curfew questions of the music vendor only', () => {
    const music = { category: 'music', quote: null, total: null } satisfies QuestionSubject;
    const asked = plan({ mustHaves: ['dhol'], venueLimits: ['musicCurfew'] });
    expect(idsFor(music, asked)).toEqual(['dhol-included', 'music-curfew']);
    const caterer = { category: 'catering', quote: null, total: null } satisfies QuestionSubject;
    expect(idsFor(caterer, asked)).toEqual([]);
  });

  it('asks the venue about elderly seating, step-free access and an indoor-only family', () => {
    const venue = { category: 'venue', quote: null, total: null } satisfies QuestionSubject;
    const asked = plan({ needs: ['elderly', 'wheelchair'], venueLimits: ['indoorOnly'] });
    expect(idsFor(venue, asked)).toEqual(['step-free-access', 'elderly-seating', 'indoor-only']);
  });

  it('asks the caterer about children, a vegetarian kitchen and no alcohol', () => {
    const catering = { category: 'catering', quote: null, total: null } satisfies QuestionSubject;
    const asked = plan({ needs: ['children'], diet: ['vegOnly', 'noAlcohol'] });
    expect(idsFor(catering, asked)).toEqual(['children-dishes', 'veg-only-menu', 'no-alcohol']);
  });

  it('gives no question for no unclear field and no need', () => {
    const catering = { category: 'catering', quote: null, total: null } satisfies QuestionSubject;
    expect(idsFor(catering, plan())).toEqual([]);
  });

  it('keeps the order of the data file whatever order the plan lists things in', () => {
    const asked = plan({
      needs: ['wheelchair', 'children'],
      diet: ['noAlcohol', 'jain', 'vegOnly'],
    });
    const catering = { category: 'catering', quote: null, total: null } satisfies QuestionSubject;
    const dataOrder = questionRows.map((row) => row.id);
    const ids = idsFor(catering, asked);
    expect(ids).toEqual(dataOrder.filter((id) => ids.includes(id)));
    expect(ids).toEqual(idsFor(catering, asked));
  });
});

describe('vendorQuestions for a change since the vendor quoted or was booked', () => {
  const venue = { category: 'venue', quote: null, total: null } satisfies QuestionSubject;
  const values = { guests: 250, capacity: 220, date: '12 Feb' };

  it('asks the date, guest count and capacity questions with the plan numbers filled in', () => {
    const asked = vendorQuestions(
      questionRows,
      venue,
      plan({ reconfirm: ['date', 'guests', 'capacity'], values }),
    );
    expect(asked.map((question) => question.id)).toEqual([
      'date-reconfirmation',
      'guest-count-reconfirmation',
      'venue-capacity',
    ]);
    expect(asked[0]?.en).toContain('12 Feb');
    expect(asked[2]?.en).toBe(
      'Guests are now 250 and you booked for 220. Can the venue take 250, and at what rate?',
    );
    expect(asked[2]?.hi).toContain('220');
    expect(
      asked.every((question) => !question.en.includes('{') && !question.hi.includes('{')),
    ).toBe(true);
  });

  it('sends the capacity question to a venue only', () => {
    const catering = { category: 'catering', quote: null, total: null } satisfies QuestionSubject;
    expect(idsFor(catering, plan({ reconfirm: ['capacity'], values }))).toEqual([]);
  });

  it('skips a question the plan cannot fill rather than sending it half written', () => {
    const noDate = plan({
      reconfirm: ['date', 'capacity'],
      values: { guests: 250, capacity: null, date: null },
    });
    expect(idsFor(venue, noDate)).toEqual([]);
  });

  it('asks nothing when nothing changed', () => {
    expect(idsFor(venue, plan({ values }))).toEqual([]);
  });
});
