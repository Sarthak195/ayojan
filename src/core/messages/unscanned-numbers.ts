// Numbers the amount scanner deliberately does not read: digits of other scripts and number
// words outside its Hindi table. A draft check that ignored them would let "thirty guests" or
// full-width digits through, so each one is reported as a number that cannot be verified.
// "one" and the Hindi "ek" and "do" are left out because they are also ordinary words.

import type { ScanHit } from '@/core/rupees/parse';
import { isWordCharacter, normalizeWord, readWord } from '@/core/rupees/number-words';

export interface UnreadSpan {
  readonly start: number;
  readonly end: number;
}

const ENGLISH_WORDS = [
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
  'hundred',
  'thousand',
  'dozen',
];

const HINDI_WORDS = [
  'तीन',
  'चार',
  'पाँच',
  'पांच',
  'छह',
  'छः',
  'सात',
  'आठ',
  'नौ',
  'दस',
  'बीस',
  'तीस',
  'चालीस',
  'पचास',
  'साठ',
  'सत्तर',
  'अस्सी',
  'नब्बे',
  'सौ',
  'हज़ार',
  'हजार',
];

const NUMBER_WORDS: ReadonlySet<string> = new Set(
  [...ENGLISH_WORDS, ...HINDI_WORDS].map((word) => normalizeWord(word)),
);

// ASCII digits and Devanagari digits are read by the scanner; every other decimal digit
// (Arabic-Indic, full-width, mathematical) is invisible to it.
const ASCII_ZERO = 0x30;
const ASCII_NINE = 0x39;
const DEVANAGARI_ZERO = 0x966;
const DEVANAGARI_NINE = 0x96f;

function isUnreadDigit(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  if (code >= ASCII_ZERO && code <= ASCII_NINE) return false;
  if (code >= DEVANAGARI_ZERO && code <= DEVANAGARI_NINE) return false;
  return /\p{Nd}/u.test(character);
}

function insideHit(index: number, hits: readonly ScanHit[]): boolean {
  return hits.some((hit) => index >= hit.start && index < hit.end);
}

/** Spans in `line` that carry a number the scanner skipped, outside the spans it did read. */
export function unscannedNumbers(line: string, hits: readonly ScanHit[]): UnreadSpan[] {
  const spans: UnreadSpan[] = [];
  let index = 0;
  while (index < line.length) {
    const code = line.charCodeAt(index);
    if (isWordCharacter(code)) {
      const end = readWord(line, index);
      const word = normalizeWord(line.slice(index, end));
      if (NUMBER_WORDS.has(word) && !insideHit(index, hits)) spans.push({ start: index, end });
      index = end;
      continue;
    }
    const character = String.fromCodePoint(line.codePointAt(index) ?? code);
    if (isUnreadDigit(character)) spans.push({ start: index, end: index + character.length });
    index += character.length;
  }
  return spans;
}
