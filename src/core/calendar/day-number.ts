// Calendar dates as plain ISO strings plus integer day numbers (days since 1970-01-01),
// using the proleptic Gregorian "civil from days" algorithm. Written by hand because the
// built-in Date reads the machine's time zone and clock: a plan computed at 23:30 IST on
// one server must equal the same plan computed on another, and src/core may not read a
// clock at all. "Today" is therefore always a parameter, never looked up here.

export type IsoDate = string & { readonly __brand: 'IsoDate' };
export type DayNumber = number & { readonly __brand: 'DayNumber' };

export type Weekday =
  'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export type DateRefusal = 'malformed' | 'not-a-real-date' | 'out-of-range' | 'not-whole-days';

export type DateResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: DateRefusal };

export interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const WEEKDAYS: readonly Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

// Four-digit ISO years only, so every valid date has exactly the shape YYYY-MM-DD.
const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const DAYS_PER_ERA = 146_097;
// Days from 0000-03-01 to 1970-01-01, the shift between the algorithm's epoch and ours.
const EPOCH_SHIFT = 719_468;
// 1970-01-01 was a Thursday, index 4 counting from Sunday.
const EPOCH_WEEKDAY = 4;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function fail<T>(reason: DateRefusal): DateResult<T> {
  return { ok: false, reason };
}

function succeed<T>(value: T): DateResult<T> {
  return { ok: true, value };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in a month, or 0 for a month outside 1 to 12 so a caller's range check fails closed. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month - 1] ?? 0;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function isDigits(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x30 || code > 0x39) return false;
  }
  return text.length > 0;
}

export function makeIsoDate(year: number, month: number, day: number): DateResult<IsoDate> {
  if (![year, month, day].every(Number.isInteger)) return fail('not-a-real-date');
  if (year < MIN_YEAR || year > MAX_YEAR) return fail('out-of-range');
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return fail('not-a-real-date');
  }
  return succeed(`${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as IsoDate);
}

/** Strict YYYY-MM-DD: "2027-2-6", "26/02/2027" and the empty string are refusals. */
export function parseIsoDate(text: string): DateResult<IsoDate> {
  const shaped =
    text.length === 10 &&
    text.charAt(4) === '-' &&
    text.charAt(7) === '-' &&
    isDigits(text.slice(0, 4)) &&
    isDigits(text.slice(5, 7)) &&
    isDigits(text.slice(8, 10));
  if (!shaped) return fail('malformed');
  return makeIsoDate(Number(text.slice(0, 4)), Number(text.slice(5, 7)), Number(text.slice(8, 10)));
}

/** The parts of a date that is already valid by construction. */
export function partsOf(date: IsoDate): DateParts {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

export function toDayNumber(date: IsoDate): DayNumber {
  const { year, month, day } = partsOf(date);
  // The algorithm's year starts in March so the leap day is the last day of the year.
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const monthIndex = month > 2 ? month - 3 : month + 9;
  const dayOfYear = Math.floor((153 * monthIndex + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return (era * DAYS_PER_ERA + dayOfEra - EPOCH_SHIFT) as DayNumber;
}

export function fromDayNumber(value: number): DateResult<IsoDate> {
  if (!Number.isInteger(value)) return fail('not-whole-days');
  const shifted = value + EPOCH_SHIFT;
  const era = Math.floor(shifted / DAYS_PER_ERA);
  const dayOfEra = shifted - era * DAYS_PER_ERA;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return makeIsoDate(year, month, day);
}

export function addDays(date: IsoDate, days: number): DateResult<IsoDate> {
  if (!Number.isInteger(days)) return fail('not-whole-days');
  return fromDayNumber(toDayNumber(date) + days);
}

/** Whole days from `from` to `to`: positive when `to` is later, zero for the same day. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function weekdayOf(date: IsoDate): Weekday {
  const index = (((toDayNumber(date) + EPOCH_WEEKDAY) % 7) + 7) % 7;
  return WEEKDAYS[index] ?? 'sunday';
}
