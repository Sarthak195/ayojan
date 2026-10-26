// Turns each value-with-quote of a model reading into a verdict the user can see. A value is
// verified only when its quote is the user's own words and every number it claims is spelled
// inside that quote; anything else is unverified with a reason and becomes a question. No
// field is ever dropped, and the "N of M values matched your words" count is computed here
// from the verdicts, never taken from the model.
//
// Claims are generic: the pipeline maps each reading field to one, choosing which numbers
// must appear in the quote (a month written as "Feb" or a shift of -14 days read from
// "2 weeks earlier" is not spelled there, so those are passed with `inQuote: false`).

import { amountsIn } from '@/core/rupees/parse';
import type { Presence } from '@/schemas/readings/vocabulary';

import type { CanonicalText } from './canonical-text';
import { canonicalise } from './canonical-text';
import type { QuoteRefusal } from './quote-match';
import { locateQuote } from './quote-match';

export type VerificationReason = QuoteRefusal | 'number-not-in-quote' | 'out-of-bounds';

export type FieldStatus = 'verified' | 'unverified' | 'unclear' | 'absent';

/** The values a number may take; the caller passes the domain bounds (budget, guests). */
export interface NumberBounds {
  readonly min: number;
  readonly max: number;
  readonly integer: boolean;
}

export interface ClaimedNumber {
  readonly value: number;
  readonly bounds?: NumberBounds;
  /** Whether the value must be among the amounts written in its quote. */
  readonly inQuote: boolean;
}

export interface Claim {
  readonly presence: Presence;
  readonly quote: string;
  readonly numbers?: readonly ClaimedNumber[];
}

export interface FieldVerdict {
  readonly status: FieldStatus;
  readonly reason?: VerificationReason;
  /** The user's own characters behind the quote, when it was found. */
  readonly displayQuote?: string;
  /** Where those characters sit in the original text, for the highlight. */
  readonly highlight?: { readonly start: number; readonly end: number };
}

export interface VerificationReport<Key extends string> {
  readonly verdicts: Readonly<Record<Key, FieldVerdict>>;
  /** Verified values. */
  readonly matched: number;
  /** Claimed values: every field except the absent and unclear ones. */
  readonly total: number;
}

function withinBounds(claimed: ClaimedNumber): boolean {
  const { value, bounds } = claimed;
  if (!Number.isFinite(value)) return false;
  if (bounds === undefined) return true;
  if (bounds.integer && !Number.isInteger(value)) return false;
  return value >= bounds.min && value <= bounds.max;
}

// Bounds come before the number check: a count of -5 or 2.5 can never be spelled as an
// amount, and "out of bounds" tells the user what to fix where "not in quote" would not.
function numberReason(
  numbers: readonly ClaimedNumber[],
  quotedWords: string,
): VerificationReason | null {
  if (!numbers.every(withinBounds)) return 'out-of-bounds';
  const spelled = numbers.some((claimed) => claimed.inQuote) ? amountsIn(quotedWords) : [];
  const allSpelled = numbers.every(
    (claimed) => !claimed.inQuote || spelled.includes(claimed.value),
  );
  return allSpelled ? null : 'number-not-in-quote';
}

/** The verdict for one claim against text that has already been canonicalised. */
export function verifyClaim(source: CanonicalText, claim: Claim): FieldVerdict {
  if (claim.presence === 'absent') return { status: 'absent' };
  const match = locateQuote(source, claim.quote);
  if (match.kind === 'refused') {
    return claim.presence === 'unclear'
      ? { status: 'unclear' }
      : { status: 'unverified', reason: match.reason };
  }
  const located = {
    displayQuote: match.displayQuote,
    highlight: { start: match.start, end: match.end },
  };
  // An unclear value keeps its words so the question can say what was read ("Feb end mein").
  if (claim.presence === 'unclear') return { status: 'unclear', ...located };
  // Numbers are read from the user's words at the match, not from the model's copy, so a
  // quote that matched only after punctuation was dropped ("1.9L" against "19L") still has
  // to spell the number the user wrote.
  const quotedWords = source.text.slice(match.canonicalStart, match.canonicalEnd);
  const reason = numberReason(claim.numbers ?? [], quotedWords);
  return reason === null
    ? { status: 'verified', ...located }
    : { status: 'unverified', reason, ...located };
}

/** "N of M values matched your words": verified over claimed, where absent and unclear are not claims. */
export function countMatched(verdicts: Iterable<FieldVerdict>): {
  readonly matched: number;
  readonly total: number;
} {
  let matched = 0;
  let total = 0;
  for (const verdict of verdicts) {
    if (verdict.status === 'verified') matched += 1;
    if (verdict.status === 'verified' || verdict.status === 'unverified') total += 1;
  }
  return { matched, total };
}

/** Verifies every claim of one reading against the text the user supplied. */
export function verifyReading<Key extends string>(
  originalText: string,
  claims: Readonly<Record<Key, Claim>>,
): VerificationReport<Key> {
  const source = canonicalise(originalText);
  const entries = (Object.keys(claims) as Key[]).map(
    (key) => [key, verifyClaim(source, claims[key])] as const,
  );
  // fromEntries defines own properties, so no key can reach an object prototype.
  const verdicts = Object.fromEntries(entries) as Record<Key, FieldVerdict>;
  return { verdicts, ...countMatched(entries.map(([, verdict]) => verdict)) };
}
