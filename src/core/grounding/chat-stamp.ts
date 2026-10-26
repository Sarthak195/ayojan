// Recognises the sender prefix a WhatsApp export puts at the start of each message, so a
// pasted chat reads as the words people wrote. Two export shapes exist:
//   iOS:     [26/10/26, 9:41 pm] Mausi: text
//   Android: 26/10/26, 9:41 pm - Mausi: text
// The reader is hand-written and every step only moves forward over a bounded window, so a
// line that merely looks like a stamp costs a few dozen character reads at most.

import { foldedPunctuation, isAsciiDigit, isAsciiLetter, isWhitespace } from './character-class';

// A display name or a phone number such as "+91 98765 43210" fits well inside this; a longer
// run before the colon is ordinary text that happens to start with a date.
const MAX_NAME_LENGTH = 60;

type Step = number | null;

function codeAt(text: string, index: number): number {
  return index < text.length ? text.charCodeAt(index) : -1;
}

function digits(text: string, index: Step, min: number, max: number): Step {
  if (index === null) return null;
  let end = index;
  while (end - index < max && isAsciiDigit(codeAt(text, end))) end += 1;
  return end - index >= min ? end : null;
}

function literal(text: string, index: Step, accepts: (code: number) => boolean): Step {
  if (index === null) return null;
  return accepts(codeAt(text, index)) ? index + 1 : null;
}

function blanks(text: string, index: Step): Step {
  if (index === null) return null;
  let end = index;
  while (end < text.length && isWhitespace(codeAt(text, end)) && codeAt(text, end) !== 0x0a) {
    end += 1;
  }
  return end;
}

const isDateSeparator = (code: number): boolean => code === 0x2f || code === 0x2e || code === 0x2d;
const isColon = (code: number): boolean => code === 0x3a;
const isDash = (code: number): boolean => code === 0x2d || foldedPunctuation(code) === '-';

// 26/10/26, or 26.10.2026, followed by optional blanks.
function datePart(text: string, start: number): Step {
  let index = digits(text, start, 1, 2);
  index = literal(text, index, isDateSeparator);
  index = digits(text, index, 1, 2);
  index = literal(text, index, isDateSeparator);
  index = digits(text, index, 2, 4);
  index = literal(text, index, (code) => code === 0x2c);
  return blanks(text, index);
}

// "am", "PM", "a.m." after the clock time, if present.
function meridiem(text: string, start: number): number {
  const first = codeAt(text, start) | 0x20;
  if (first !== 0x61 && first !== 0x70) return start;
  let index = start + 1;
  if (codeAt(text, index) === 0x2e) index += 1;
  if ((codeAt(text, index) | 0x20) !== 0x6d) return start;
  index += 1;
  if (codeAt(text, index) === 0x2e) index += 1;
  return isAsciiLetter(codeAt(text, index)) ? start : index;
}

// 9:41, 21:41:05, 9:41 pm.
function timePart(text: string, start: Step): Step {
  let index = digits(text, start, 1, 2);
  index = literal(text, index, isColon);
  index = digits(text, index, 2, 2);
  if (index !== null && isColon(codeAt(text, index))) index = digits(text, index + 1, 2, 2);
  const beforeMeridiem = blanks(text, index);
  if (beforeMeridiem === null) return null;
  const afterMeridiem = meridiem(text, beforeMeridiem);
  return afterMeridiem === beforeMeridiem ? index : afterMeridiem;
}

// The sender name and its colon; the name may hold anything except a line break.
function senderPart(text: string, start: Step): Step {
  if (start === null) return null;
  const limit = Math.min(text.length, start + MAX_NAME_LENGTH + 1);
  for (let index = start; index < limit; index += 1) {
    const code = codeAt(text, index);
    if (code === 0x0a) return null;
    if (isColon(code)) return index > start ? index + 1 : null;
  }
  return null;
}

function bracketedStamp(text: string, start: number): Step {
  let index = literal(text, start, (code) => code === 0x5b);
  index = index === null ? null : datePart(text, index);
  index = blanks(text, timePart(text, index));
  index = literal(text, index, (code) => code === 0x5d);
  return senderPart(text, blanks(text, index));
}

function dashedStamp(text: string, start: number): Step {
  let index = blanks(text, timePart(text, datePart(text, start)));
  index = blanks(text, literal(text, index, isDash));
  return senderPart(text, index);
}

/** The index just past a chat stamp and sender name starting at `start`, or null if none. */
export function chatStampEnd(text: string, start: number): number | null {
  return bracketedStamp(text, start) ?? dashedStamp(text, start);
}
