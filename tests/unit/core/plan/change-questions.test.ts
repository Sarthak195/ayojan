import { describe, expect, it } from 'vitest';

import { confirmChange } from '@/core/plan/change-answers';
import {
  changeQuestions,
  changeValuesFrom,
  type ChangeClaims,
  type ChangeQuestion,
  type CurrentHeadline,
} from '@/core/plan/change-questions';

import { isoDate, today } from './plan-fixture';

const CURRENT: CurrentHeadline = {
  guests: 200,
  budgetInr: 800_000,
  eventDate: isoDate('2027-02-26'),
};

const NOTHING: ChangeClaims = {
  guests: { mode: 'absent', count: null },
  budget: { mode: 'absent', direction: 'none', amountInr: null },
  dateShift: { presence: 'absent', shiftDays: null },
  dateWritten: { presence: 'absent', day: null, month: null, year: null },
  reallocate: { presence: 'absent', to: 'unclear', amountInr: null },
};

function claims(changes: Partial<ChangeClaims>): ChangeClaims {
  return { ...NOTHING, ...changes };
}

function questionsFor(
  changes: Partial<ChangeClaims>,
  current: CurrentHeadline = CURRENT,
): readonly ChangeQuestion[] {
  const { values } = changeValuesFrom(claims(changes), current, today);
  return changeQuestions(values, current, today);
}

describe('change questions (FR-24)', () => {
  it.each<[string, Partial<ChangeClaims>, readonly ChangeQuestion[]]>([
    [
      'a budget that only decreased asks "By how much?" with 5 and 10 percent of the current budget',
      { budget: { mode: 'directionOnly', direction: 'decrease', amountInr: null } },
      [
        {
          kind: 'budget-how-much',
          direction: 'decrease',
          options: [
            { percent: 5, budgetInr: 760_000 },
            { percent: 10, budgetInr: 720_000 },
          ],
          selected: null,
        },
      ],
    ],
    [
      'a budget that only increased offers 5 and 10 percent more',
      { budget: { mode: 'directionOnly', direction: 'increase', amountInr: null } },
      [
        {
          kind: 'budget-how-much',
          direction: 'increase',
          options: [
            { percent: 5, budgetInr: 840_000 },
            { percent: 10, budgetInr: 880_000 },
          ],
          selected: null,
        },
      ],
    ],
    [
      'an absolute budget needs no question',
      { budget: { mode: 'absolute', direction: 'none', amountInr: 750_000 } },
      [],
    ],
    [
      'a budget cut by an amount needs no question',
      { budget: { mode: 'delta', direction: 'decrease', amountInr: 50_000 } },
      [],
    ],
    [
      'a budget cut below Rs 5,000 asks again with the reason',
      { budget: { mode: 'absolute', direction: 'none', amountInr: 4_000 } },
      [{ kind: 'budget-out-of-range', budgetInr: 4_000 }],
    ],
    [
      'a zero budget asks again with the reason',
      { budget: { mode: 'absolute', direction: 'none', amountInr: 0 } },
      [{ kind: 'budget-out-of-range', budgetInr: 0 }],
    ],
    [
      'a shift and a written date that disagree ask "Which date?" with both',
      {
        dateShift: { presence: 'present', shiftDays: -14 },
        dateWritten: { presence: 'present', day: 5, month: 3, year: null },
      },
      [{ kind: 'which-date', candidates: ['2027-02-12', '2027-03-05'], selected: null }],
    ],
    [
      'a shift and a written date that agree ask nothing',
      {
        dateShift: { presence: 'present', shiftDays: -14 },
        dateWritten: { presence: 'present', day: 12, month: 2, year: 2027 },
      },
      [],
    ],
    [
      'a shift that lands on or before today asks again with the reason',
      { dateShift: { presence: 'present', shiftDays: -118 } },
      [{ kind: 'date-passed', date: '2026-10-31' }],
    ],
    [
      'guests that fall to zero ask again with the reason',
      { guests: { mode: 'delta', count: -200 } },
      [{ kind: 'guests-out-of-range', guests: 0 }],
    ],
    [
      'a move with no category asks what was meant',
      { reallocate: { presence: 'present', to: 'unclear', amountInr: 50_000 } },
      [{ kind: 'move-unclear' }],
    ],
    ['a message with nothing to change says so', {}, [{ kind: 'nothing-to-change' }]],
  ])('%s', (_name, changes, expected) => {
    expect(questionsFor(changes)).toEqual(expected);
  });

  it('rounds the offered budgets to Rs 100 below one lakh', () => {
    const small = { ...CURRENT, budgetInr: 50_000 };
    const [question] = questionsFor(
      { budget: { mode: 'directionOnly', direction: 'decrease', amountInr: null } },
      small,
    );
    expect(question).toMatchObject({ options: [{ budgetInr: 47_500 }, { budgetInr: 45_000 }] });
  });

  it('marks an unclear guest count and an unreadable date for the check screen', () => {
    const { values, unclear } = changeValuesFrom(
      claims({
        guests: { mode: 'unclear', count: null },
        dateShift: { presence: 'unclear', shiftDays: null },
      }),
      CURRENT,
      today,
    );
    expect(unclear).toEqual(['guests', 'date']);
    expect([values.guests, values.dateCandidates]).toEqual([null, []]);
  });

  it('reads the explainer sentence into a guest delta and one date', () => {
    const { values } = changeValuesFrom(
      claims({
        guests: { mode: 'delta', count: 50 },
        budget: { mode: 'directionOnly', direction: 'decrease', amountInr: null },
        dateShift: { presence: 'present', shiftDays: -14 },
      }),
      CURRENT,
      today,
    );
    expect(values).toEqual({
      guests: { mode: 'delta', count: 50 },
      budget: { mode: 'directionOnly', direction: 'decrease', amountInr: null },
      dateCandidates: ['2027-02-12'],
      reallocate: null,
    });
  });
});

describe('confirming a change', () => {
  const howMuch = changeValuesFrom(
    claims({
      guests: { mode: 'delta', count: 50 },
      budget: { mode: 'directionOnly', direction: 'decrease', amountInr: null },
      dateShift: { presence: 'present', shiftDays: -14 },
    }),
    CURRENT,
    today,
  ).values;

  it('refuses until "By how much?" is answered, and never picks for the family', () => {
    const open = confirmChange(howMuch, { budgetInr: null, eventDate: null }, CURRENT, today);
    expect(open.ok).toBe(false);
  });

  it.each([
    ['an offered option', 760_000, true],
    ['an exact amount', 750_000, true],
    ['an amount under Rs 5,000', 4_999, false],
  ])('accepts %s only when it is inside the bounds', (_name, budgetInr, ok) => {
    expect(confirmChange(howMuch, { budgetInr, eventDate: null }, CURRENT, today).ok).toBe(ok);
  });

  it('builds the op fields from the answers', () => {
    expect(confirmChange(howMuch, { budgetInr: 750_000, eventDate: null }, CURRENT, today)).toEqual(
      {
        ok: true,
        fields: { guests: 250, budgetInr: 750_000, eventDate: '2027-02-12', reallocate: null },
      },
    );
  });

  it('accepts only one of the offered dates for "Which date?"', () => {
    const { values } = changeValuesFrom(
      claims({
        dateShift: { presence: 'present', shiftDays: -14 },
        dateWritten: { presence: 'present', day: 5, month: 3, year: null },
      }),
      CURRENT,
      today,
    );
    const answer = (eventDate: string): boolean =>
      confirmChange(values, { budgetInr: null, eventDate }, CURRENT, today).ok;
    expect([answer('2027-03-05'), answer('2027-02-12'), answer('2027-03-06')]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('carries a complete Move money request into the op', () => {
    const { values } = changeValuesFrom(
      claims({ reallocate: { presence: 'present', to: 'photo', amountInr: 50_000 } }),
      CURRENT,
      today,
    );
    expect(confirmChange(values, { budgetInr: null, eventDate: null }, CURRENT, today)).toEqual({
      ok: true,
      fields: {
        guests: null,
        budgetInr: null,
        eventDate: null,
        reallocate: { to: 'photo', amountInr: 50_000 },
      },
    });
  });
});
