// Turns the event date, read or typed, into a real date after today or a question. The year is
// picked here, never by the model: "26/2" means the next 26 February (resolveDayMonth), and a
// date that is today or earlier is asked again with the date shown (FR-4).

import { parseIsoDate, partsOf, type IsoDate } from '@/core/calendar/day-number';
import { resolveDayMonth, type DayMonth } from '@/core/calendar/relative-date';

import { ask, type BriefQuestion } from './questions';
import type { Resolved } from './count-answer';

// Day first, as written in India: 26/2, 26-02-2027, 26.2.2027. The year is optional.
const DAY_FIRST = /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}))?$/;

type DateText = { readonly parts: DayMonth } | null;

function partsOfText(text: string): DateText {
  const iso = parseIsoDate(text);
  if (iso.ok) return { parts: partsOf(iso.value) };
  const match = DAY_FIRST.exec(text);
  if (match === null) return null;
  const [, day, month, year] = match;
  return {
    parts: {
      day: Number(day),
      month: Number(month),
      year: year === undefined ? null : Number(year),
    },
  };
}

function settle(text: string, today: IsoDate): Resolved<string | null> {
  const read = partsOfText(text);
  if (read === null) return { value: null, question: ask('eventDate', 'date-invalid', text) };
  const resolved = resolveDayMonth(read.parts, today);
  if (resolved.kind === 'date') return { value: resolved.date, question: null };
  if (resolved.reason === 'date-passed') {
    return { value: resolved.date, question: ask('eventDate', 'date-passed', resolved.date) };
  }
  return { value: null, question: ask('eventDate', 'date-invalid', text) };
}

function missing(): Resolved<string | null> {
  const question: BriefQuestion = ask('eventDate', 'missing');
  return { value: null, question };
}

/**
 * `kept` is the date the reading resolved (possibly one that has passed); `answer` is what was
 * typed, undefined when the field was not on the page. Both go through the same checks.
 */
export function resolveEventDate(
  kept: string | null,
  answer: string | null | undefined,
  today: IsoDate,
): Resolved<string | null> {
  const source = answer === undefined ? kept : answer;
  const text = source?.trim() ?? '';
  return text === '' ? missing() : settle(text, today);
}
