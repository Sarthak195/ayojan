// One canonical spelling of pasted text, so a quote the model copied matches the user's words
// even when a phone added curly quotes, emoji, chat stamps or a different rupee marker. The
// original is never altered: the canonical copy carries a map from each of its units back to
// the original range, and a highlight is drawn on the original characters. One left-to-right
// pass after NFC, with a bounded look-ahead only at line starts (chat stamps) and at rupee
// markers, so the cost is linear in the input.

import {
  foldedPunctuation,
  isAsciiDigit,
  isAsciiLetter,
  isEmojiPart,
  isInvisible,
  isWhitespace,
  RUPEE_SIGN,
  ZERO_WIDTH_JOINER,
  ZERO_WIDTH_NON_JOINER,
} from './character-class';
import { chatStampEnd } from './chat-stamp';
import type { MappedText } from './normal-form';
import { normalForm } from './normal-form';

export interface CanonicalText extends MappedText {
  readonly original: string;
}

/** The canonical spelling of every rupee marker: Rs, rs, Rs., INR and the rupee sign. */
export const RUPEE_MARKER = 'Rs';

interface Builder {
  readonly source: MappedText;
  readonly parts: string[];
  readonly starts: number[];
  readonly ends: number[];
  pendingSpace: number | null;
}

function pushUnits(builder: Builder, piece: string, from: number, to: number): void {
  const start = builder.source.starts[from] ?? 0;
  const end = builder.source.ends[to - 1] ?? start;
  if (builder.pendingSpace !== null && builder.parts.length > 0) {
    const spaceAt = builder.pendingSpace;
    builder.parts.push(' ');
    builder.starts.push(builder.source.starts[spaceAt] ?? start);
    builder.ends.push(builder.source.ends[spaceAt] ?? start);
  }
  builder.pendingSpace = null;
  for (let unit = 0; unit < piece.length; unit += 1) {
    builder.parts.push(piece.charAt(unit));
    builder.starts.push(start);
    builder.ends.push(end);
  }
}

// Runs of whitespace (and dropped emoji or stamps) become one space, emitted lazily so that
// leading and trailing breaks vanish.
function breakWord(builder: Builder, at: number): void {
  builder.pendingSpace ??= at;
}

function lastEmitted(builder: Builder): number {
  const last = builder.parts.at(-1);
  return last === undefined || builder.pendingSpace !== null ? -1 : last.charCodeAt(0);
}

function letterAt(text: string, index: number): boolean {
  return index >= 0 && index < text.length && isAsciiLetter(text.charCodeAt(index));
}

function lowerAt(text: string, index: number): number {
  return index < text.length ? text.charCodeAt(index) | 0x20 : -1;
}

// Length of a rupee marker at `index`, or 0. Letters on either side mean an ordinary word
// ("Mrs", "RSVP", "hours"), so "Rs" is a marker only when it stands apart from letters.
function rupeeMarkerLength(text: string, index: number): number {
  if (text.charCodeAt(index) === RUPEE_SIGN) return 1;
  if (letterAt(text, index - 1)) return 0;
  const first = lowerAt(text, index);
  const second = lowerAt(text, index + 1);
  let length = 0;
  if (first === 0x72 && second === 0x73) length = 2;
  else if (first === 0x69 && second === 0x6e && lowerAt(text, index + 2) === 0x72) length = 3;
  if (length === 0 || letterAt(text, index + length)) return 0;
  return text.charCodeAt(index + length) === 0x2e ? length + 1 : length;
}

function pushRupee(builder: Builder, from: number, to: number): void {
  const before = lastEmitted(builder);
  if (isAsciiLetter(before) || isAsciiDigit(before)) breakWord(builder, from);
  pushUnits(builder, RUPEE_MARKER, from, to);
  breakWord(builder, to - 1);
}

interface Cursor {
  atLineStart: boolean;
  afterEmoji: boolean;
}

// A joiner inside an emoji sequence goes with the emoji; anywhere else (Devanagari conjuncts
// such as a half letter) it shapes the script and must survive.
function joinerNextToEmoji(text: string, index: number, afterEmoji: boolean): boolean {
  const next = text.codePointAt(index + 1);
  return afterEmoji || (next !== undefined && isEmojiPart(next));
}

// Handles the character at `index` and returns the index of the next one to read.
function step(builder: Builder, cursor: Cursor, index: number): number {
  const text = builder.source.text;
  if (cursor.atLineStart) {
    const stampEnd = chatStampEnd(text, index);
    if (stampEnd !== null) {
      breakWord(builder, index);
      cursor.atLineStart = false;
      return stampEnd;
    }
  }
  const code = text.codePointAt(index) ?? 0;
  const width = code > 0xffff ? 2 : 1;
  const wasAfterEmoji = cursor.afterEmoji;
  cursor.afterEmoji = false;
  if (isWhitespace(code)) {
    breakWord(builder, index);
    if (code === 0x0a || code === 0x0d) cursor.atLineStart = true;
    return index + 1;
  }
  if (isInvisible(code)) return index + 1;
  cursor.atLineStart = false;
  if (isEmojiPart(code)) {
    breakWord(builder, index);
    cursor.afterEmoji = true;
    return index + width;
  }
  const isJoiner = code === ZERO_WIDTH_JOINER || code === ZERO_WIDTH_NON_JOINER;
  if (isJoiner && joinerNextToEmoji(text, index, wasAfterEmoji)) {
    cursor.afterEmoji = true;
    return index + 1;
  }
  const markerLength = rupeeMarkerLength(text, index);
  if (markerLength > 0) {
    pushRupee(builder, index, index + markerLength);
    return index + markerLength;
  }
  const folded = foldedPunctuation(code);
  pushUnits(builder, folded ?? text.slice(index, index + width), index, index + width);
  return index + width;
}

/** The canonical copy of `original` with its map back to the original characters. */
export function canonicalise(original: string): CanonicalText {
  const source = normalForm(original);
  const builder: Builder = { source, parts: [], starts: [], ends: [], pendingSpace: null };
  const cursor: Cursor = { atLineStart: true, afterEmoji: false };
  let index = 0;
  while (index < source.text.length) index = step(builder, cursor, index);
  return { original, text: builder.parts.join(''), starts: builder.starts, ends: builder.ends };
}

/** The original range [start, end) behind the canonical range [start, end). */
export function originalRange(
  canonical: CanonicalText,
  start: number,
  end: number,
): { readonly start: number; readonly end: number } {
  if (end <= start) {
    const at = canonical.starts[start] ?? canonical.original.length;
    return { start: at, end: at };
  }
  return { start: canonical.starts[start] ?? 0, end: canonical.ends[end - 1] ?? 0 };
}
