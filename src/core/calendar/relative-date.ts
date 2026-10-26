// Turns what the model or the user said about a date into a real date. The model returns
// only a day, a month and maybe a year (or a shift in days); this module picks the year, so
// no prompt or cache key carries today's date and the same words always resolve the same
// way for the same `today`. Anything that cannot be a future date is a question with a
// reason, never an exception and never an invalid date.

import type { DateResult, IsoDate } from './day-number';
import { addDays, daysInMonth, makeIsoDate, partsOf } from './day-number';

export type DateQuestion =
  | 'day-out-of-range'
  | 'month-out-of-range'
  | 'year-out-of-range'
  | 'not-a-real-date'
  | 'date-passed'
  | 'shift-not-whole';

export type DateResolution =
  | { readonly kind: 'date'; readonly date: IsoDate; readonly yearAssumed: boolean }
  | { readonly kind: 'question'; readonly reason: DateQuestion; readonly date: IsoDate | null };

export interface DayMonth {
  readonly day: number;
  readonly month: number;
  readonly year: number | null;
}

// A wedding plan is for the near future; a year before 2000 is a typo or a misread, and
// past 2100 the Gregorian leap rules in this module stop being the interesting part.
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

// The next 29 February is at most eight years away (across a skipped century leap year).
const LOOKAHEAD_YEARS = 8;

function question(reason: DateQuestion, date: IsoDate | null = null): DateResolution {
  return { kind: 'question', reason, date };
}

function inRange(value: number, low: number, high: number): boolean {
  return Number.isInteger(value) && value >= low && value <= high;
}

// ISO strings of one fixed width order the same as the dates they name.
function isAfter(date: IsoDate, today: IsoDate): boolean {
  return date > today;
}

function checkFields(input: DayMonth): DateQuestion | null {
  if (!inRange(input.month, 1, 12)) return 'month-out-of-range';
  if (!inRange(input.day, 1, 31)) return 'day-out-of-range';
  if (input.year !== null && !inRange(input.year, MIN_YEAR, MAX_YEAR)) return 'year-out-of-range';
  return null;
}

function nextOccurrence(input: DayMonth, today: IsoDate): DateResolution {
  const firstYear = partsOf(today).year;
  for (let year = firstYear; year <= firstYear + LOOKAHEAD_YEARS; year += 1) {
    if (input.day > daysInMonth(year, input.month)) continue;
    if (year > MAX_YEAR) return question('year-out-of-range');
    const made = makeIsoDate(year, input.month, input.day);
    // Strictly after today: a date that is today itself means the same day next year.
    if (made.ok && isAfter(made.value, today)) {
      return { kind: 'date', date: made.value, yearAssumed: true };
    }
  }
  return question('not-a-real-date');
}

/**
 * Resolves a day and month against `today`. With no year it is the next occurrence strictly
 * after today (26 Feb on 2026-10-31 is 2027-02-26; 31 Oct on that day is 2027-10-31; 29 Feb
 * is the next leap year). An explicit year is kept as given: if that date is today or
 * earlier it is a `date-passed` question that still carries the date so it can be shown.
 */
export function resolveDayMonth(input: DayMonth, today: IsoDate): DateResolution {
  const invalid = checkFields(input);
  if (invalid !== null) return question(invalid);
  if (input.year === null) return nextOccurrence(input, today);
  const made = makeIsoDate(input.year, input.month, input.day);
  if (!made.ok) return question('not-a-real-date');
  if (!isAfter(made.value, today)) return question('date-passed', made.value);
  return { kind: 'date', date: made.value, yearAssumed: false };
}

function fromShift(shifted: DateResult<IsoDate>): DateResolution | IsoDate {
  if (shifted.ok) return shifted.value;
  return question(shifted.reason === 'not-whole-days' ? 'shift-not-whole' : 'year-out-of-range');
}

/**
 * Moves `base` (usually the event date) by a number of days. A result that lands on or
 * before `today` is a `date-passed` question, so a "14 days earlier" change can never
 * silently produce a past event.
 */
export function resolveShift(base: IsoDate, shiftDays: number, today: IsoDate): DateResolution {
  const moved = fromShift(addDays(base, shiftDays));
  if (typeof moved !== 'string') return moved;
  const { year } = partsOf(moved);
  if (year < MIN_YEAR || year > MAX_YEAR) return question('year-out-of-range');
  if (!isAfter(moved, today)) return question('date-passed', moved);
  return { kind: 'date', date: moved, yearAssumed: false };
}
