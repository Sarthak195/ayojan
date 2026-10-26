// Turns one typed or read number (budget, guests, venue capacity) into a value or a question.
// parseAmount reads "8 lakh", "dedh lakh" and Devanagari digits but skips a minus sign as
// punctuation, so "-5" would silently become 5 guests; the sign is checked here first.

import { parseAmount, type UnclearReason } from '@/core/rupees/parse';

import type { Bounds } from './brief-draft';
import { ask, type BriefField, type BriefQuestion, type QuestionReason } from './questions';

export interface Resolved<T> {
  readonly value: T;
  readonly question: BriefQuestion | null;
}

// A minus that opens a number (not the "-" inside "5-6" or the "/-" after "1,90,000").
const LEADING_MINUS = /(?:^|[^\p{L}\p{N}])[-−–]\s*\p{N}/u;

const UNCLEAR_REASONS: Record<UnclearReason, QuestionReason> = {
  empty: 'missing',
  'no-amount': 'unreadable',
  'several-amounts': 'several-numbers',
  fractional: 'not-whole',
  // Beyond fifteen digits: out of every bound this app has.
  'too-large': 'out-of-range',
};

function isBlank(text: string | null | undefined): boolean {
  return text === null || text === undefined || text.trim() === '';
}

function readText(text: string): { value: number } | { reason: QuestionReason } {
  const parsed = parseAmount(text);
  if (parsed.kind === 'unclear') return { reason: UNCLEAR_REASONS[parsed.reason] };
  const negative = LEADING_MINUS.test(text);
  return { value: negative && parsed.inr !== 0 ? -parsed.inr : parsed.inr };
}

/**
 * `kept` is what the reading verified (null when it could not); `answer` is what the person
 * typed (undefined when the field was not on the page). Required fields ask when empty, optional
 * ones stay null, and anything given but unusable is asked about rather than dropped.
 */
export function resolveCount(
  field: BriefField,
  kept: number | null,
  answer: string | null | undefined,
  bounds: Bounds,
  required: boolean,
): Resolved<number | null> {
  let value = kept;
  let given: string | number | null = kept;
  if (answer !== undefined) {
    if (isBlank(answer)) {
      return { value: null, question: required ? ask(field, 'missing') : null };
    }
    const text = answer?.trim() ?? '';
    const read = readText(text);
    if ('reason' in read) {
      const bounded = read.reason === 'out-of-range' ? bounds : null;
      return { value: null, question: ask(field, read.reason, text, bounded) };
    }
    value = read.value;
    given = value;
  }
  if (value === null) return { value, question: required ? ask(field, 'missing') : null };
  const inRange = Number.isSafeInteger(value) && value >= bounds.min && value <= bounds.max;
  return { value, question: inRange ? null : ask(field, 'out-of-range', given, bounds) };
}
