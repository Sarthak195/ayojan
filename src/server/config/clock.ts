import 'server-only';

import { fromDayNumber, type IsoDate } from '@/core/calendar/day-number';

/** Milliseconds since the epoch. Injected everywhere so tests pin the instant. */
export type Now = () => number;

// The one place the server reads the wall clock; src/core never does, it is handed `today`.
export const systemNow: Now = () => Date.now();

const MS_PER_DAY = 86_400_000;
// India has kept one offset with no daylight saving since 1945, so a fixed shift is exact and
// avoids depending on the host's time zone data for the date every plan is computed against.
const IST_OFFSET_MS = 19_800_000;

/** Today in Asia/Kolkata: the date a plan's deadlines and statuses are computed against. */
export function todayInIndia(now: Now = systemNow): IsoDate {
  return dateOrThrow(fromDayNumber(Math.floor((now() + IST_OFFSET_MS) / MS_PER_DAY)));
}

// Gemini free-tier allowances are assumed to reset at midnight Pacific (D17), which does
// observe daylight saving, so this one needs real zone rules rather than a fixed offset.
const QUOTA_TIME_ZONE = 'America/Los_Angeles';

interface WallClock {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly secondOfDay: number;
}

const FORMAT_HOLDER = Symbol.for('ayojan.clock.quota-format');
type FormatHolder = typeof globalThis & { [FORMAT_HOLDER]?: Intl.DateTimeFormat };

// Building a formatter loads zone data, so one is kept per process rather than per call.
function quotaFormat(): Intl.DateTimeFormat {
  const holder: FormatHolder = globalThis;
  const held = holder[FORMAT_HOLDER];
  if (held !== undefined) return held;
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone: QUOTA_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });
  holder[FORMAT_HOLDER] = created;
  return created;
}

function wallClockAt(ms: number): WallClock {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of quotaFormat().formatToParts(ms)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  const { year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0 } = parts;
  return { year, month, day, secondOfDay: hour * 3600 + minute * 60 + second };
}

/**
 * The Pacific date that names the current quota day: the key for per-day call counters and
 * daily caps, so they roll over when the allowances are assumed to reset.
 */
export function quotaDayKey(now: Now = systemNow): IsoDate {
  const wall = wallClockAt(now());
  return dateOrThrow(
    fromDayNumber(Math.floor(Date.UTC(wall.year, wall.month - 1, wall.day) / MS_PER_DAY)),
  );
}

/**
 * Whole seconds until the next quota day starts, for a Retry-After on a daily cap. Rounded
 * up, and at least one, so a client never retries a moment too early.
 */
export function secondsUntilNextQuotaDay(now: Now = systemNow): number {
  const instant = now();
  const wall = wallClockAt(instant);
  const nextMidnightAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day + 1);
  // The zone's offset at the coming midnight; read at a first guess and once more, because a
  // daylight-saving change between now and midnight shifts it by an hour.
  let guess = nextMidnightAsUtc - offsetAt(instant);
  guess = nextMidnightAsUtc - offsetAt(guess);
  return Math.max(1, Math.ceil((guess - instant) / 1000));
}

function offsetAt(ms: number): number {
  const wall = wallClockAt(ms);
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day) + wall.secondOfDay * 1000;
  return wallAsUtc - Math.floor(ms / 1000) * 1000;
}

function dateOrThrow(result: ReturnType<typeof fromDayNumber>): IsoDate {
  // Only an instant outside years 1 to 9999 lands here, which no real clock produces.
  if (!result.ok)
    throw new RangeError(`The clock is outside the supported range: ${result.reason}.`);
  return result.value;
}
