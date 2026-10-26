import { describe, expect, it } from 'vitest';

import type { DateRefusal, IsoDate, Weekday } from '@/core/calendar/day-number';
import {
  addDays,
  daysBetween,
  daysInMonth,
  fromDayNumber,
  isLeapYear,
  makeIsoDate,
  parseIsoDate,
  partsOf,
  toDayNumber,
  weekdayOf,
} from '@/core/calendar/day-number';

function iso(text: string): IsoDate {
  const parsed = parseIsoDate(text);
  if (!parsed.ok) throw new Error(`test fixture ${text} is not a valid date: ${parsed.reason}`);
  return parsed.value;
}

describe('leap years', () => {
  it.each<[number, boolean]>([
    [2000, true],
    [1900, false],
    [2100, false],
    [2024, true],
    [2027, false],
    [2028, true],
    [2400, true],
  ])('%i leap year: %s', (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });

  it('gives February 29 days only in a leap year', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2100, 2)).toBe(28);
  });

  it('gives zero days for a month that does not exist', () => {
    expect(daysInMonth(2026, 0)).toBe(0);
    expect(daysInMonth(2026, 13)).toBe(0);
  });
});

describe('parseIsoDate accepts only real YYYY-MM-DD dates', () => {
  it.each(['2026-10-31', '2028-02-29', '2000-02-29', '1970-01-01', '2100-12-31', '0001-01-01'])(
    'accepts %s',
    (text) => {
      expect(parseIsoDate(text)).toEqual({ ok: true, value: text });
    },
  );

  it.each<[string, string, DateRefusal]>([
    ['a one-digit month and day', '2027-2-6', 'malformed'],
    ['a day-first slash date', '26/02/2027', 'malformed'],
    ['the empty string', '', 'malformed'],
    ['trailing text', '2027-02-26T00:00', 'malformed'],
    ['leading space', ' 2027-02-26', 'malformed'],
    ['letters for digits', '2027-0a-26', 'malformed'],
    ['a signed year', '+027-02-26', 'malformed'],
    ['Devanagari digits', '२०२७-०२-२६', 'malformed'],
    ['February 29 in a common year', '2027-02-29', 'not-a-real-date'],
    ['February 29 in 1900', '1900-02-29', 'not-a-real-date'],
    ['February 29 in 2100', '2100-02-29', 'not-a-real-date'],
    ['April 31', '2027-04-31', 'not-a-real-date'],
    ['day zero', '2027-04-00', 'not-a-real-date'],
    ['month zero', '2027-00-10', 'not-a-real-date'],
    ['month thirteen', '2027-13-10', 'not-a-real-date'],
    ['year zero', '0000-01-01', 'out-of-range'],
  ])('refuses %s', (_name, text, reason) => {
    expect(parseIsoDate(text)).toEqual({ ok: false, reason });
  });
});

describe('makeIsoDate', () => {
  it('pads to the ISO shape', () => {
    expect(makeIsoDate(2027, 2, 6)).toEqual({ ok: true, value: '2027-02-06' });
    expect(makeIsoDate(5, 1, 1)).toEqual({ ok: true, value: '0005-01-01' });
  });

  it.each<[string, number, number, number, DateRefusal]>([
    ['a fractional day', 2027, 2, 6.5, 'not-a-real-date'],
    ['NaN', Number.NaN, 2, 6, 'not-a-real-date'],
    ['year 10000', 10_000, 1, 1, 'out-of-range'],
    ['a negative year', -5, 1, 1, 'out-of-range'],
  ])('refuses %s', (_name, year, month, day, reason) => {
    expect(makeIsoDate(year, month, day)).toEqual({ ok: false, reason });
  });
});

describe('day numbers', () => {
  it('counts 1970-01-01 as day zero', () => {
    expect(toDayNumber(iso('1970-01-01'))).toBe(0);
    expect(toDayNumber(iso('1970-01-02'))).toBe(1);
    expect(toDayNumber(iso('1969-12-31'))).toBe(-1);
  });

  it('round-trips every day from 1970-01-01 to 2100-12-31', () => {
    const first = toDayNumber(iso('1970-01-01'));
    const last = toDayNumber(iso('2100-12-31'));
    let previous: number = first - 1;
    for (let value: number = first; value <= last; value += 1) {
      const date = fromDayNumber(value);
      expect(date.ok).toBe(true);
      if (!date.ok) return;
      const back = toDayNumber(date.value);
      if (back !== value) expect(back).toBe(value);
      expect(back - previous).toBe(1);
      previous = back;
    }
  });

  it('round-trips the proleptic range ends and years before 1970', () => {
    for (const text of ['0001-01-01', '1600-02-29', '1899-12-31', '9999-12-31']) {
      const value = toDayNumber(iso(text));
      expect(fromDayNumber(value)).toEqual({ ok: true, value: text });
    }
  });

  it('refuses a non-integer day number', () => {
    expect(fromDayNumber(1.5)).toEqual({ ok: false, reason: 'not-whole-days' });
    expect(fromDayNumber(Number.NaN)).toEqual({ ok: false, reason: 'not-whole-days' });
  });

  it('refuses a day number outside the four-digit years', () => {
    expect(fromDayNumber(10_000_000)).toEqual({ ok: false, reason: 'out-of-range' });
    expect(fromDayNumber(-800_000)).toEqual({ ok: false, reason: 'out-of-range' });
  });
});

describe('addDays', () => {
  it.each<[string, string, number, string]>([
    ['one day forward in a month', '2026-10-30', 1, '2026-10-31'],
    ['across a month end', '2026-10-31', 1, '2026-11-01'],
    ['across a year end', '2026-12-31', 1, '2027-01-01'],
    ['one day back across a month start', '2026-11-01', -1, '2026-10-31'],
    ['one day back across a year start', '2027-01-01', -1, '2026-12-31'],
    ['a full common year', '2026-10-31', 365, '2027-10-31'],
    ['a full leap year', '2027-10-31', 366, '2028-10-31'],
    ['118 days back from the event', '2027-02-26', -118, '2026-10-31'],
    ['into a leap day', '2028-02-28', 1, '2028-02-29'],
    ['over a missing leap day', '2100-02-28', 1, '2100-03-01'],
    ['zero days', '2027-02-26', 0, '2027-02-26'],
  ])('%s: %s plus %i is %s', (_name, from, days, expected) => {
    expect(addDays(iso(from), days)).toEqual({ ok: true, value: expected });
  });

  it('refuses a fractional number of days', () => {
    expect(addDays(iso('2027-02-26'), 1.5)).toEqual({ ok: false, reason: 'not-whole-days' });
  });

  it('refuses a result beyond year 9999', () => {
    expect(addDays(iso('9999-12-31'), 1)).toEqual({ ok: false, reason: 'out-of-range' });
  });
});

describe('daysBetween', () => {
  it.each<[string, string, string, number]>([
    ['today to the event', '2026-10-31', '2027-02-26', 118],
    ['the same day', '2027-02-26', '2027-02-26', 0],
    ['the event back to today', '2027-02-26', '2026-10-31', -118],
    ['consecutive days', '2026-12-31', '2027-01-01', 1],
    ['across a leap day', '2028-02-28', '2028-03-01', 2],
    ['across a skipped leap day', '2100-02-28', '2100-03-01', 1],
  ])('%s', (_name, from, to, expected) => {
    expect(daysBetween(iso(from), iso(to))).toBe(expected);
  });
});

describe('weekdayOf', () => {
  it.each<[string, Weekday]>([
    ['2026-10-31', 'saturday'],
    ['2027-02-26', 'friday'],
    ['1970-01-01', 'thursday'],
    ['1969-12-31', 'wednesday'],
    ['2000-01-01', 'saturday'],
    ['2028-02-29', 'tuesday'],
    ['2026-10-26', 'monday'],
    ['2026-10-25', 'sunday'],
  ])('%s is a %s', (date, expected) => {
    expect(weekdayOf(iso(date))).toBe(expected);
  });
});

describe('partsOf', () => {
  it('splits a valid date', () => {
    expect(partsOf(iso('2027-02-06'))).toEqual({ year: 2027, month: 2, day: 6 });
  });
});
