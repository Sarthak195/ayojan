// Finds the model's quote in the user's text, so every value shown can point at the words it
// came from. Two passes only, and no fuzzy matching: a quote that is not the user's words,
// give or take spelling noise, is reported as not found rather than guessed at.
//   1. exact: the canonical quote inside the canonical text;
//   2. normalised: both case-folded with punctuation removed, mapped back through the
//      canonical text to the original.
// Several occurrences are fine for verification; the first one on word edges is shown. A match
// that starts or ends inside a word of the user's text is skipped ("8 lakh" inside "18 lakh"),
// so each pass is a run of indexOf calls, still O(n x m) with n at most 2,000 and m at most 160.

import { QUOTE_LIMIT_CHARACTERS } from '@/schemas/readings/vocabulary';

import { isPunctuation, isWhitespace } from './character-class';
import type { CanonicalText } from './canonical-text';
import { canonicalise, originalRange } from './canonical-text';
import { firstOnWordEdges } from './word-edges';

/** Below this many characters a quote such as "8" or "ok" would match almost any text. */
export const QUOTE_MIN_CHARACTERS = 3;

export type QuoteRefusal = 'quote-too-long' | 'quote-too-short' | 'quote-not-found';

export type QuoteMatch =
  | {
      readonly kind: 'found';
      readonly pass: 'exact' | 'normalised';
      /** The matched range in the canonical text, for reading numbers out of it. */
      readonly canonicalStart: number;
      readonly canonicalEnd: number;
      /** The matched range in the original text, for the highlight. */
      readonly start: number;
      readonly end: number;
      /** The user's own characters at that range, never the model's copy. */
      readonly displayQuote: string;
    }
  | { readonly kind: 'refused'; readonly reason: QuoteRefusal };

interface Folded {
  readonly text: string;
  /** For each unit of `text`, the canonical index it came from. */
  readonly origins: readonly number[];
}

// Code points, not UTF-16 units: the limit is stated to the model in characters, and a
// Devanagari or emoji character must count once.
function codePointLength(text: string): number {
  let length = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const isTrailSurrogate = code >= 0xdc00 && code <= 0xdfff;
    const followsLead =
      index > 0 && text.charCodeAt(index - 1) >= 0xd800 && text.charCodeAt(index - 1) <= 0xdbff;
    if (!(isTrailSurrogate && followsLead)) length += 1;
  }
  return length;
}

// Case-folded with punctuation removed and blanks collapsed again, keeping for each unit the
// canonical index it came from.
function fold(text: string): Folded {
  const parts: string[] = [];
  const origins: number[] = [];
  let pendingSpace = -1;
  let index = 0;
  for (const character of text) {
    if (isWhitespace(character.charCodeAt(0))) {
      if (pendingSpace < 0) pendingSpace = index;
    } else if (!isPunctuation(character)) {
      if (pendingSpace >= 0 && parts.length > 0) {
        parts.push(' ');
        origins.push(pendingSpace);
      }
      pendingSpace = -1;
      const lower = character.toLowerCase();
      parts.push(lower);
      for (let remaining = lower.length; remaining > 0; remaining -= 1) origins.push(index);
    }
    index += character.length;
  }
  return { text: parts.join(''), origins };
}

function found(
  source: CanonicalText,
  pass: 'exact' | 'normalised',
  canonicalStart: number,
  canonicalEnd: number,
): QuoteMatch {
  const range = originalRange(source, canonicalStart, canonicalEnd);
  return {
    kind: 'found',
    pass,
    canonicalStart,
    canonicalEnd,
    start: range.start,
    end: range.end,
    displayQuote: source.original.slice(range.start, range.end),
  };
}

function normalisedMatch(source: CanonicalText, quote: string): QuoteMatch | null {
  const foldedQuote = fold(quote).text;
  if (codePointLength(foldedQuote) < QUOTE_MIN_CHARACTERS) return null;
  const foldedSource = fold(source.text);
  const at = firstOnWordEdges(foldedSource.text, foldedQuote);
  if (at < 0) return null;
  const first = foldedSource.origins[at] ?? 0;
  const last = foldedSource.origins[at + foldedQuote.length - 1] ?? first;
  // The last folded unit may come from a surrogate pair: extend to the whole code point.
  const lastWidth = (source.text.codePointAt(last) ?? 0) > 0xffff ? 2 : 1;
  return found(source, 'normalised', first, last + lastWidth);
}

/** Where `quote` occurs in the user's text, or why it was refused. */
export function locateQuote(source: CanonicalText, quote: string): QuoteMatch {
  // Counted before any folding: the limit is on what the model returned (D36).
  if (codePointLength(quote) > QUOTE_LIMIT_CHARACTERS) {
    return { kind: 'refused', reason: 'quote-too-long' };
  }
  const canonicalQuote = canonicalise(quote).text;
  if (codePointLength(canonicalQuote) < QUOTE_MIN_CHARACTERS) {
    return { kind: 'refused', reason: 'quote-too-short' };
  }
  const at = firstOnWordEdges(source.text, canonicalQuote);
  if (at >= 0) return found(source, 'exact', at, at + canonicalQuote.length);
  return normalisedMatch(source, canonicalQuote) ?? { kind: 'refused', reason: 'quote-not-found' };
}
