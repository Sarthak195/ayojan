// Where a word of the user's text starts and ends. A quote that begins or ends inside a word
// is not what the user wrote: "8 lakh" sits inside "18 lakh" and "200 guests" inside
// "1200 guests" as plain substrings, so without these checks a misread number would show as
// verified. Letters, combining marks and digits of any script count as word characters, so
// Devanagari words and digits are held together the same way.

const WORD_CHARACTER = /[\p{L}\p{M}\p{N}]/u;
const DIGIT = /\p{N}/u;

function isWordUnit(unit: string | undefined): boolean {
  return unit !== undefined && WORD_CHARACTER.test(unit);
}

function isDigitUnit(unit: string | undefined): boolean {
  return unit !== undefined && DIGIT.test(unit);
}

/** True when [start, end) neither starts nor ends in the middle of a word of `text`. */
export function onWordEdges(text: string, start: number, end: number): boolean {
  const opensInsideWord = isWordUnit(text[start - 1]) && isWordUnit(text[start]);
  const closesInsideWord = isWordUnit(text[end - 1]) && isWordUnit(text[end]);
  return !opensInsideWord && !closesInsideWord;
}

/** The first occurrence of `needle` in `text` that sits on word edges, or -1. */
export function firstOnWordEdges(text: string, needle: string): number {
  let at = text.indexOf(needle);
  while (at >= 0 && !onWordEdges(text, at, at + needle.length)) {
    at = text.indexOf(needle, at + 1);
  }
  return at;
}

// A comma or point between two digits is part of one number ("1,80,000", "1.9L").
function joinsDigits(text: string, index: number): boolean {
  const unit = text[index];
  return (
    (unit === ',' || unit === '.') && isDigitUnit(text[index - 1]) && isDigitUnit(text[index + 1])
  );
}

/**
 * [start, end) widened to whole words and whole numbers, so the amounts read from a match are
 * the ones the user wrote: "80,000" inside "1,80,000" widens to the whole figure.
 */
export function wholeWordSpan(
  text: string,
  start: number,
  end: number,
): { readonly start: number; readonly end: number } {
  let from = start;
  while (from > 0 && (isWordUnit(text[from - 1]) || joinsDigits(text, from - 1))) from -= 1;
  let to = end;
  while (to < text.length && (isWordUnit(text[to]) || joinsDigits(text, to))) to += 1;
  return { start: from, end: to };
}
