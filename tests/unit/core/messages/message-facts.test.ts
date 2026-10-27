import { describe, expect, it } from 'vitest';

import { factNumbers } from '@/core/messages/fact-numbers';
import { reconfirmationQuestionIds } from '@/core/messages/message-facts';

import { CATERER, REVISED, UNCLEAR, date, makeFacts } from './facts-fixture';

describe('message facts', () => {
  it('derives the gap as projected minus budget, positive when over', () => {
    expect(makeFacts().gapInr).toBe(150_000);
    const under = makeFacts({ now: { ...REVISED.now, projectedInr: 1_300_000 } });
    expect(under.gapInr).toBe(-200_000);
  });

  it('keeps the old and new headline numbers of the latest revision', () => {
    const facts = makeFacts();
    expect(facts.hasRevision).toBe(true);
    expect(facts.before?.guests).toBe(280);
    expect(facts.now.guests).toBe(250);
  });

  it('keeps applied levers, at-risk tasks and unclear quote fields', () => {
    const facts = makeFacts();
    expect(facts.levers.map((lever) => lever.id)).toEqual(['simpler-decor']);
    expect(facts.atRisk.map((task) => task.taskId)).toEqual(['print-invitations']);
    expect(facts.unclearQuotes[0]?.fields).toEqual(['taxRate']);
  });

  it('keeps the three most urgent tasks, Late first, and counts the rest', () => {
    const task = (id: string, status: 'late' | 'atRisk', dueBy: string) => ({
      taskId: id,
      name: { en: id, hi: id },
      status,
      dueBy: date(dueBy),
      start: 'on' as const,
    });
    const facts = makeFacts({
      atRisk: [
        task('a', 'atRisk', '2026-12-05'),
        task('b', 'atRisk', '2026-12-02'),
        task('c', 'late', '2026-12-09'),
        task('d', 'atRisk', '2026-12-01'),
        task('e', 'late', '2026-12-08'),
      ],
    });
    expect(facts.atRisk.map((t) => t.taskId)).toEqual(['e', 'c', 'd']);
    expect(facts.moreAtRiskCount).toBe(2);
  });

  it('lists the re-confirmation questions in the order first asked', () => {
    expect(reconfirmationQuestionIds(makeFacts())).toEqual([
      'guest-count-reconfirmation',
      'venue-capacity',
      'date-reconfirmation',
    ]);
  });

  it('asks a vendor the same question once', () => {
    const facts = makeFacts({
      vendors: [{ ...CATERER, questionIds: ['tax-rate', 'tax-rate'] }],
    });
    expect(facts.vendors[0]?.questionIds).toEqual(['tax-rate']);
  });

  it('gives a plan summary and no vendor re-confirmation for a plan with no revision', () => {
    const facts = makeFacts({ before: null });
    expect(facts.hasRevision).toBe(false);
    expect(reconfirmationQuestionIds(facts)).toEqual([]);
    // The venue had only re-confirmation questions, so it has nothing to be messaged about.
    expect(facts.vendors.map((vendor) => vendor.category)).toEqual(['catering']);
    expect(facts.vendors[0]?.questionIds).toEqual(['tax-rate']);
  });

  it('drops a quote with no unclear field', () => {
    const facts = makeFacts({ unclearQuotes: [{ ...UNCLEAR, fields: [] }] });
    expect(facts.unclearQuotes).toEqual([]);
  });
});

describe('the count of tasks left out', () => {
  const tasks = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      taskId: `t${String(index)}`,
      name: { en: 'T', hi: 'T' },
      status: 'atRisk' as const,
      dueBy: date(`2026-12-${String(10 + index)}`),
      start: 'on' as const,
    }));

  it('supports the remainder only when tasks were left out', () => {
    // Ten tasks, three shown: 7 is in no date, headline or count of the facts but the remainder.
    expect(factNumbers(makeFacts({ atRisk: tasks(10) })).has(7)).toBe(true);
    expect(factNumbers(makeFacts({ atRisk: tasks(3) })).has(7)).toBe(false);
  });
});

describe('the numbers the facts support', () => {
  const numbers = factNumbers(makeFacts());

  it.each<[string, number]>([
    ['the new budget', 1_500_000],
    ['the old budget', 1_400_000],
    ['the budget change', 100_000],
    ['the new guest count', 250],
    ['the guests removed', 30],
    ['the projected spend', 1_650_000],
    ['the gap to the budget', 150_000],
    ['the days the date moved', 14],
    ['the days to the event', 47],
    ['the day of the new date', 12],
    ['the year of the date', 2026],
    ['a lever saving', 45_000],
    ['the number of vendors', 2],
    ['a booked venue capacity', 220],
    ['the day of a task due date', 20],
  ])('includes %s', (_name, value) => {
    expect(numbers.has(value)).toBe(true);
  });

  it('does not include a number the plan never produced', () => {
    expect(numbers.has(2_000_000)).toBe(false);
    expect(numbers.has(13)).toBe(false);
  });

  it('has no date-change numbers when the plan has no revision', () => {
    const plain = factNumbers(makeFacts({ before: null }));
    expect(plain.has(1_400_000)).toBe(false);
    expect(plain.has(30)).toBe(false);
    expect(plain.has(1_500_000)).toBe(true);
  });
});
