import 'server-only';

import type { CanonicalText } from '@/core/grounding/canonical-text';
import type {
  Claim,
  ClaimedNumber,
  FieldVerdict as CheckedField,
  NumberBounds,
} from '@/core/grounding/verification';
import { countMatched, verifyClaim } from '@/core/grounding/verification';
import { MAX_YEAR, MIN_YEAR } from '@/core/calendar/relative-date';
import { amountsIn } from '@/core/rupees/parse';
import { toShortText } from '@/schemas/plan/short-text';
import { MAX_DISPLAY_QUOTES, type FieldVerdict } from '@/schemas/plan/state-token';
import type { Presence } from '@/schemas/readings/vocabulary';

/** Integer bounds for a claimed count or amount; the domain limits live with each reader. */
export function whole(min: number, max: number): NumberBounds {
  return { min, max, integer: true };
}

/** A number the quote must spell, or nothing when the model gave none. */
export function spelled(value: number | null, bounds: NumberBounds): ClaimedNumber[] {
  return value === null ? [] : [{ value, bounds, inQuote: true }];
}

/**
 * A field claims "present" but carries no number it needs, so there is nothing to verify and
 * nothing to plan with: it is asked as unclear rather than shown as matched.
 */
export function presenceWith(presence: Presence, needed: number | null): Presence {
  return presence === 'present' && needed === null ? 'unclear' : presence;
}

export function presenceOf(value: string): Presence {
  return value === 'unclear' ? 'unclear' : 'present';
}

interface Entry {
  readonly field: string;
  readonly verdict: CheckedField;
  /** Headline fields (budget, guests, date) keep their place when the list is cut. */
  readonly headline: boolean;
}

export interface Verdicts {
  /** Verifies one claim without recording it, for a reader that may still correct the verdict. */
  verify(claim: Claim): CheckedField;
  /** Verifies one claim, records its verdict under `field` and returns it. */
  check(field: string, claim: Claim, headline?: boolean): CheckedField;
  /** Records a verdict the reader corrected itself (a date that resolved to a question). */
  record(field: string, verdict: CheckedField, headline?: boolean): void;
  finish(): { readonly fields: FieldVerdict[]; readonly matched: number; readonly total: number };
}

function displayed(entry: Entry): FieldVerdict {
  const quote = entry.verdict.displayQuote;
  return {
    field: entry.field.slice(0, 40),
    status: entry.verdict.status,
    reason: entry.verdict.reason ?? null,
    displayQuote: quote === undefined ? null : toShortText(quote),
  };
}

// The sealed link holds at most 16 display quotes (D31, D39), and a brief can claim far more.
// What must survive the cut is what the user has to act on: headline fields first, then every
// question, then matched values, each group in reading order.
function rank(entry: Entry): number {
  if (entry.headline) return 0;
  return entry.verdict.status === 'verified' ? 2 : 1;
}

function shown(entries: readonly Entry[]): FieldVerdict[] {
  const kept = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.verdict.status !== 'absent')
    .sort((left, right) => rank(left.entry) - rank(right.entry) || left.index - right.index)
    .slice(0, MAX_DISPLAY_QUOTES)
    .sort((left, right) => left.index - right.index);
  return kept.map(({ entry }) => displayed(entry));
}

/** Collects the verdicts of one reading against one canonical text. */
export function verdictsFor(source: CanonicalText): Verdicts {
  const entries: Entry[] = [];
  return {
    verify(claim) {
      return verifyClaim(source, claim);
    },
    check(field, claim, headline = false) {
      const verdict = verifyClaim(source, claim);
      entries.push({ field, verdict, headline });
      return verdict;
    },
    record(field, verdict, headline = false) {
      entries.push({ field, verdict, headline });
    },
    finish() {
      // Counted over every claim, before the display cut, so the N of M is never flattered.
      const counts = countMatched(entries.map((entry) => entry.verdict));
      return { fields: shown(entries), ...counts };
    },
  };
}

export function isVerified(verdict: CheckedField): boolean {
  return verdict.status === 'verified';
}

/**
 * The value a reading may carry into the pending state. Verified values pass. An out-of-range
 * number the user really wrote (0 guests, a phone number as a budget) also passes, so the check
 * page can ask about it with its reason; it must be spelled in the user's own words, so a
 * number the model made up never survives as a pre-filled answer. The scanner reads no sign,
 * so a negative value can never pass this way.
 */
export function keptNumber(verdict: CheckedField, value: number | null): number | null {
  if (value === null || !Number.isSafeInteger(value)) return null;
  if (verdict.status === 'verified') return value;
  const spoken =
    verdict.reason === 'out-of-bounds' &&
    verdict.displayQuote !== undefined &&
    amountsIn(verdict.displayQuote).includes(value);
  return spoken ? value : null;
}

/** The verdict that turns a verified date into a question it could not answer by itself. */
export function outOfBounds(verdict: CheckedField): CheckedField {
  return { ...verdict, status: 'unverified', reason: 'out-of-bounds' };
}

/**
 * The numbers of a written date. The day and year must be spelled in the quote; the month need
 * not be, because it is usually a word ("Feb", "फ़रवरी"). Nothing to claim without a day and month.
 */
export function dayMonthNumbers(
  day: number | null,
  month: number | null,
  year: number | null,
): ClaimedNumber[] {
  if (day === null || month === null) return [];
  const numbers: ClaimedNumber[] = [
    { value: day, bounds: whole(1, 31), inQuote: true },
    { value: month, bounds: whole(1, 12), inQuote: false },
  ];
  if (year !== null)
    numbers.push({ value: year, bounds: whole(MIN_YEAR, MAX_YEAR), inQuote: true });
  return numbers;
}
