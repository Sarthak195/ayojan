import { describe, expect, it } from 'vitest';

import type { IsoDate } from '@/core/calendar/day-number';
import { parseIsoDate } from '@/core/calendar/day-number';
import type { DateQuestion } from '@/core/calendar/relative-date';
import { resolveDayMonth, resolveShift } from '@/core/calendar/relative-date';

function iso(text: string): IsoDate {
  const parsed = parseIsoDate(text);
  if (!parsed.ok) throw new Error(`test fixture ${text} is not a valid date`);
  return parsed.value;
}

const TODAY = iso('2026-10-31');

describe('resolveShift moves the event date', () => {
  it.each<[string, string, number, string]>([
    ['14 days earlier', '2027-02-26', -14, '2027-02-12'],
    ['14 days later', '2027-02-26', 14, '2027-03-12'],
    ['60 days earlier', '2027-02-26', -60, '2026-12-28'],
    ['no shift', '2027-02-26', 0, '2027-02-26'],
    ['across the year end, forward', '2026-12-20', 20, '2027-01-09'],
    ['across the year end, backward', '2027-01-05', -3, '2027-01-02'],
    ['to the day after today', '2027-02-26', -117, '2026-11-01'],
  ])('%s', (_name, base, shift, expected) => {
    expect(resolveShift(iso(base), shift, TODAY)).toEqual({
      kind: 'date',
      date: expected,
      yearAssumed: false,
    });
  });

  it.each<[string, string, number, DateQuestion, string | null]>([
    ['lands exactly on today', '2027-02-26', -118, 'date-passed', '2026-10-31'],
    ['lands before today', '2027-02-26', -119, 'date-passed', '2026-10-30'],
    ['is not a whole number of days', '2027-02-26', 1.5, 'shift-not-whole', null],
    ['leaves the supported years', '2100-12-31', 1, 'year-out-of-range', null],
    ['overflows the calendar', '9999-12-31', 1, 'year-out-of-range', null],
  ])('is a question when the shift %s', (_name, base, shift, reason, date) => {
    expect(resolveShift(iso(base), shift, TODAY)).toEqual({ kind: 'question', reason, date });
  });
});

describe('resolveDayMonth with no year picks the next occurrence strictly after today', () => {
  it.each<[string, number, number, string]>([
    ['26 Feb is next year', 26, 2, '2027-02-26'],
    ['31 Oct (today) goes to next year', 31, 10, '2027-10-31'],
    ['12 Dec is this year', 12, 12, '2026-12-12'],
    ['1 Nov is tomorrow, this year', 1, 11, '2026-11-01'],
    ['30 Oct (yesterday) goes to next year', 30, 10, '2027-10-30'],
    ['1 Jan is next year', 1, 1, '2027-01-01'],
    ['29 Feb is the next leap year', 29, 2, '2028-02-29'],
    ['28 Feb is next year', 28, 2, '2027-02-28'],
  ])('%s', (_name, day, month, expected) => {
    expect(resolveDayMonth({ day, month, year: null }, TODAY)).toEqual({
      kind: 'date',
      date: expected,
      yearAssumed: true,
    });
  });

  it('gives 29 Feb on a leap day itself as the next leap year', () => {
    expect(resolveDayMonth({ day: 29, month: 2, year: null }, iso('2028-02-29'))).toEqual({
      kind: 'date',
      date: '2032-02-29',
      yearAssumed: true,
    });
  });

  it('skips the missing leap day of 2100', () => {
    expect(resolveDayMonth({ day: 29, month: 2, year: null }, iso('2096-03-01'))).toEqual({
      kind: 'question',
      reason: 'year-out-of-range',
      date: null,
    });
  });

  it('gives the same answer for the same words on the same day, whatever the order of calls', () => {
    const first = resolveDayMonth({ day: 26, month: 2, year: null }, TODAY);
    resolveDayMonth({ day: 1, month: 1, year: null }, iso('2030-05-05'));
    expect(resolveDayMonth({ day: 26, month: 2, year: null }, TODAY)).toEqual(first);
  });

  it.each<[string, number, number, DateQuestion]>([
    ['31 April', 31, 4, 'not-a-real-date'],
    ['30 February', 30, 2, 'not-a-real-date'],
    ['31 June', 31, 6, 'not-a-real-date'],
    ['day zero', 0, 5, 'day-out-of-range'],
    ['day 32', 32, 5, 'day-out-of-range'],
    ['a negative day', -1, 5, 'day-out-of-range'],
    ['a fractional day', 1.5, 5, 'day-out-of-range'],
    ['month zero', 5, 0, 'month-out-of-range'],
    ['month 13', 5, 13, 'month-out-of-range'],
    ['NaN month', 5, Number.NaN, 'month-out-of-range'],
  ])('is a question for %s', (_name, day, month, reason) => {
    expect(resolveDayMonth({ day, month, year: null }, TODAY)).toEqual({
      kind: 'question',
      reason,
      date: null,
    });
  });

  it('is a question when the next occurrence would be beyond 2100', () => {
    expect(resolveDayMonth({ day: 12, month: 12, year: null }, iso('2100-12-31'))).toEqual({
      kind: 'question',
      reason: 'year-out-of-range',
      date: null,
    });
  });
});

describe('resolveDayMonth with an explicit year keeps that year', () => {
  it.each<[string, number, number, number, string]>([
    ['a future date', 26, 2, 2027, '2027-02-26'],
    ['the day after today', 1, 11, 2026, '2026-11-01'],
    ['a leap day in a leap year', 29, 2, 2028, '2028-02-29'],
    ['the last supported year', 31, 12, 2100, '2100-12-31'],
  ])('%s', (_name, day, month, year, expected) => {
    expect(resolveDayMonth({ day, month, year }, TODAY)).toEqual({
      kind: 'date',
      date: expected,
      yearAssumed: false,
    });
  });

  it.each<[string, number, number, number, string]>([
    ['today itself', 31, 10, 2026, '2026-10-31'],
    ['yesterday', 30, 10, 2026, '2026-10-30'],
    ['an explicit past year', 12, 3, 2020, '2020-03-12'],
    ['5 March 2026, a past date in the current year', 5, 3, 2026, '2026-03-05'],
  ])('flags %s as passed and carries the date', (_name, day, month, year, expected) => {
    expect(resolveDayMonth({ day, month, year }, TODAY)).toEqual({
      kind: 'question',
      reason: 'date-passed',
      date: expected,
    });
  });

  it.each<[string, number, number, number, DateQuestion]>([
    ['29 February 2027', 29, 2, 2027, 'not-a-real-date'],
    ['31 April 2027', 31, 4, 2027, 'not-a-real-date'],
    ['29 February 2100', 29, 2, 2100, 'not-a-real-date'],
    ['year 1999', 1, 1, 1999, 'year-out-of-range'],
    ['year 2101', 1, 1, 2101, 'year-out-of-range'],
    ['a two-digit year', 1, 1, 27, 'year-out-of-range'],
    ['a fractional year', 1, 1, 2027.5, 'year-out-of-range'],
    ['day zero', 0, 5, 2027, 'day-out-of-range'],
    ['month 13', 5, 13, 2027, 'month-out-of-range'],
  ])('is a question for %s', (_name, day, month, year, reason) => {
    expect(resolveDayMonth({ day, month, year }, TODAY)).toEqual({
      kind: 'question',
      reason,
      date: null,
    });
  });
});

describe('the clock is only ever a parameter', () => {
  it('resolves the same words differently for a different today', () => {
    const early = resolveDayMonth({ day: 26, month: 2, year: null }, iso('2026-01-01'));
    const late = resolveDayMonth({ day: 26, month: 2, year: null }, iso('2026-10-31'));
    expect(early).toMatchObject({ kind: 'date', date: '2026-02-26' });
    expect(late).toMatchObject({ kind: 'date', date: '2027-02-26' });
  });
});
