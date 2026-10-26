import 'server-only';

import type { IsoDate } from '@/core/calendar/day-number';
import { resolveDayMonth, resolveShift, type DateResolution } from '@/core/calendar/relative-date';
import type { Claim, FieldVerdict as CheckedField } from '@/core/grounding/verification';
import { BUDGET_MAX_INR, BUDGET_MIN_INR } from '@/schemas/plan/brief';
import { toShortText } from '@/schemas/plan/short-text';
import { ChangeReading } from '@/schemas/readings/change-reading';
import * as change from '@/server/prompts/change';

import type { ReadingOutcome } from './reading-outcome';
import { runReader, type PendingValues, type ReaderDeps } from './run-reader';
import {
  dayMonthNumbers,
  isVerified,
  keptNumber,
  outOfBounds,
  spelled,
  whole,
  type Verdicts,
} from './verdicts';

type ChangeValues = Extract<PendingValues, { kind: 'change' }>['values'];

const GUESTS = whole(1, 5_000);
const BUDGET = whole(BUDGET_MIN_INR, BUDGET_MAX_INR);
const AMOUNT = whole(1, BUDGET_MAX_INR);
// Two years either way covers any real move of an event; more is a misreading.
const SHIFT = whole(-730, 730);
const MAX_SOURCES = 3;

export interface ChangeInput {
  /** The change message exactly as typed; only its canonical copy reaches the model. */
  readonly text: string;
  readonly today: IsoDate;
  /** The plan's current event date: a day shift moves this date. */
  readonly eventDate: IsoDate;
}

/** Collects the user's words behind verified values: the change op keeps three as its sources. */
type Sources = string[];

function noteSource(sources: Sources, verdict: CheckedField): CheckedField {
  if (isVerified(verdict) && verdict.displayQuote !== undefined) {
    const text = toShortText(verdict.displayQuote);
    if (!sources.includes(text)) sources.push(text);
  }
  return verdict;
}

// A delta is written without its sign ("50 more", "30 kam"), so the quote must spell its size.
function sizeOf(value: number | null): number | null {
  return value === null ? null : Math.abs(value);
}

function readGuests(
  reading: ChangeReading['guests'],
  v: Verdicts,
  s: Sources,
): ChangeValues['guests'] {
  const { mode, count, quote } = reading;
  const claimed = mode === 'absolute' || mode === 'delta';
  const presence = mode === 'absent' ? 'absent' : claimed && count !== null ? 'present' : 'unclear';
  const numbers = spelled(mode === 'delta' ? sizeOf(count) : count, GUESTS);
  const verdict = noteSource(s, v.check('guests', { presence, quote, numbers }, true));
  if (!claimed || count === null) return null;
  // A total of 0 the user really wrote is kept, so the check page can ask about it.
  const kept =
    mode === 'absolute' ? keptNumber(verdict, count) : isVerified(verdict) ? count : null;
  return kept === null ? null : { mode, count: kept };
}

function readBudget(
  reading: ChangeReading['budget'],
  v: Verdicts,
  s: Sources,
): ChangeValues['budget'] {
  const { direction, amountInr, quote } = reading;
  // A delta or total without an amount still says which way the budget moved: "By how much?".
  const mode = reading.mode !== 'absent' && amountInr === null ? 'directionOnly' : reading.mode;
  const claim: Claim = {
    presence: mode === 'absent' ? 'absent' : 'present',
    quote,
    numbers:
      mode === 'absolute'
        ? spelled(amountInr, BUDGET)
        : mode === 'delta'
          ? spelled(sizeOf(amountInr), AMOUNT)
          : [],
  };
  const verdict = noteSource(s, v.check('budget', claim, true));
  if (mode === 'absent') return null;
  if (mode === 'directionOnly') {
    return isVerified(verdict) ? { mode, direction, amountInr: null } : null;
  }
  const kept =
    mode === 'absolute'
      ? keptNumber(verdict, amountInr)
      : isVerified(verdict)
        ? sizeOf(amountInr)
        : null;
  return kept === null ? null : { mode, direction, amountInr: kept };
}

/** A resolved date is a candidate; one that has passed stays a candidate but becomes a question. */
function candidate(
  field: string,
  verdict: CheckedField,
  resolved: DateResolution,
  v: Verdicts,
): string | null {
  if (resolved.kind === 'date') {
    v.record(field, verdict, true);
    return resolved.date;
  }
  v.record(field, outOfBounds(verdict), true);
  return resolved.date;
}

function readShift(
  input: ChangeInput,
  reading: ChangeReading['dateShift'],
  v: Verdicts,
  s: Sources,
): string | null {
  const { presence, shiftDays, quote } = reading;
  const numbers = shiftDays === null ? [] : [{ value: shiftDays, bounds: SHIFT, inQuote: false }];
  const said = presence === 'present' && shiftDays === null ? 'unclear' : presence;
  const verdict = noteSource(s, v.verify({ presence: said, quote, numbers }));
  if (!isVerified(verdict) || shiftDays === null) {
    v.record('dateShift', verdict, true);
    return null;
  }
  return candidate('dateShift', verdict, resolveShift(input.eventDate, shiftDays, input.today), v);
}

function readWritten(
  input: ChangeInput,
  reading: ChangeReading['dateWritten'],
  v: Verdicts,
  s: Sources,
): string | null {
  const { presence, day, month, year, quote } = reading;
  const numbers = dayMonthNumbers(day, month, year);
  const said = presence === 'present' && numbers.length === 0 ? 'unclear' : presence;
  const verdict = noteSource(s, v.verify({ presence: said, quote, numbers }));
  if (!isVerified(verdict) || day === null || month === null) {
    v.record('dateWritten', verdict, true);
    return null;
  }
  return candidate('dateWritten', verdict, resolveDayMonth({ day, month, year }, input.today), v);
}

function readReallocate(
  reading: ChangeReading['reallocate'],
  v: Verdicts,
  s: Sources,
): ChangeValues['reallocate'] {
  const { presence, to, amountInr, quote } = reading;
  const numbers = spelled(amountInr, AMOUNT);
  const verdict = noteSource(s, v.check('reallocate', { presence, quote, numbers }));
  if (presence !== 'present' || !isVerified(verdict)) return null;
  return { to: to === 'unclear' ? null : to, amountInr };
}

function buildChange(input: ChangeInput, reading: ChangeReading, v: Verdicts): PendingValues {
  const sources: Sources = [];
  const guests = readGuests(reading.guests, v, sources);
  const budget = readBudget(reading.budget, v, sources);
  // When a shift and a written date disagree there are two candidates: "Which date?" (FR-24).
  const dates = [
    readShift(input, reading.dateShift, v, sources),
    readWritten(input, reading.dateWritten, v, sources),
  ].filter((date): date is string => date !== null);
  const reallocate = readReallocate(reading.reallocate, v, sources);
  return {
    kind: 'change',
    values: {
      guests,
      budget,
      dateCandidates: [...new Set(dates)],
      reallocate,
      sources: sources.slice(0, MAX_SOURCES),
    },
  };
}

/** Call 3 (G3): reads a change message into a pending reading, or the form twin. */
export function readChange(deps: ReaderDeps, input: ChangeInput): Promise<ReadingOutcome> {
  return runReader(deps, {
    kind: 'change',
    prompt: change,
    schema: ChangeReading,
    text: input.text,
    build: (reading, verdicts) => buildChange(input, reading, verdicts),
  });
}
