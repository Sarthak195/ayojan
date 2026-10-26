// Character classes the canonicaliser folds or drops. Every class is a set of code points or
// a single-code-point property test, so classifying one character is constant time and the
// whole pass stays linear. Dash and curly-quote code points are written as numbers because
// the repository bans the em dash character in source.

const SINGLE_QUOTES: ReadonlySet<number> = new Set([
  0x2018, 0x2019, 0x201a, 0x201b, 0x2032, 0x2035,
]);
const DOUBLE_QUOTES: ReadonlySet<number> = new Set([
  0x201c, 0x201d, 0x201e, 0x201f, 0x2033, 0x2036, 0x00ab, 0x00bb,
]);
const DASHES: ReadonlySet<number> = new Set([
  0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212, 0xfe58, 0xfe63, 0xff0d,
]);

// Characters that carry no visible text: dropped without leaving a word break, because a
// zero-width space or a direction mark inside a word must not split it in two.
const INVISIBLE: ReadonlySet<number> = new Set([0x00ad, 0x200b, 0x200e, 0x200f, 0x2060, 0xfeff]);

const WHITESPACE: ReadonlySet<number> = new Set([
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
]);

export const ZERO_WIDTH_JOINER = 0x200d;
export const ZERO_WIDTH_NON_JOINER = 0x200c;
export const RUPEE_SIGN = 0x20b9;

const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const PUNCTUATION = /\p{P}/u;

/** The ASCII character a curly quote or a dash folds to, or null for any other character. */
export function foldedPunctuation(code: number): string | null {
  if (SINGLE_QUOTES.has(code)) return "'";
  if (DOUBLE_QUOTES.has(code)) return '"';
  if (DASHES.has(code)) return '-';
  return null;
}

export function isInvisible(code: number): boolean {
  return INVISIBLE.has(code);
}

export function isWhitespace(code: number): boolean {
  return WHITESPACE.has(code) || (code >= 0x2000 && code <= 0x200a);
}

// The property covers the pictographs themselves; the joiner-free parts of an emoji sequence
// (presentation selectors, skin tones, keycaps, flags, tag letters) are listed by range.
// Latin-1 signs such as the copyright sign are pictographic by property but read as text.
export function isEmojiPart(code: number): boolean {
  if (code === 0xfe0e || code === 0xfe0f || code === 0x20e3) return true;
  if (code >= 0x1f3fb && code <= 0x1f3ff) return true;
  if (code >= 0x1f1e6 && code <= 0x1f1ff) return true;
  if (code >= 0xe0020 && code <= 0xe007f) return true;
  return code > 0xff && PICTOGRAPHIC.test(String.fromCodePoint(code));
}

export function isAsciiLetter(code: number): boolean {
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
}

export function isAsciiDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

export function isPunctuation(character: string): boolean {
  return PUNCTUATION.test(character);
}
