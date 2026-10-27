// The closed vocabulary of the amount scanner: unit words (sau, hazaar, lakh, crore) and the
// Hindi number words of D34 and D44 (ek to das, the tens bees to nabbe, dedh, dhai, sava,
// saadhe, paune). It is a fixed table on purpose. A word outside it, such as English "eight"
// or Hindi "pachpan", is left unread so the user is asked instead of the scanner guessing a
// figure. A number word counts only with a unit after it, so "ke saath" (with) and English
// "do" stay ordinary words.

const DEVANAGARI_START = 0x0900;
const DEVANAGARI_MARKS_END = 0x0963;
const DEVANAGARI_EXTENDED_START = 0x0970;
const DEVANAGARI_END = 0x097f;
const ZERO_WIDTH_NON_JOINER = 0x200c;
const ZERO_WIDTH_JOINER = 0x200d;

// Longest table entry is under ten code units; anything longer cannot be in the table,
// so skipping the lookup keeps a giant adversarial "word" from being normalised.
const MAX_WORD_LENGTH = 16;

const HUNDRED = 100;
const THOUSAND = 1_000;
const LAKH = 100_000;
const CRORE = 10_000_000;

export interface Quantity {
  /** Quarters of the unit, so "dedh" is 6 and every table value stays an integer. */
  readonly quarters: number;
}

export interface Prefix {
  readonly kind: 'prefix';
  readonly offsetQuarters: number;
}

// Table keys are normalised at build time with the same function used on input, so it does
// not matter whether this file spells a nukta as one code point or two.
function table<T>(entries: readonly (readonly [readonly string[], T])[]): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const [words, value] of entries) {
    for (const word of words) map.set(normalizeWord(word), value);
  }
  return map;
}

/** Lower-cases, decomposes (U+095B and U+095C become base letter plus nukta) and drops joiners. */
export function normalizeWord(word: string): string {
  if (word.length > MAX_WORD_LENGTH) return '';
  let kept = '';
  for (const character of word.toLowerCase().normalize('NFD')) {
    const code = character.codePointAt(0);
    if (code !== ZERO_WIDTH_JOINER && code !== ZERO_WIDTH_NON_JOINER) kept += character;
  }
  return kept;
}

export function isWordCharacter(code: number): boolean {
  if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) return true;
  if (code >= DEVANAGARI_START && code <= DEVANAGARI_MARKS_END) return true;
  if (code >= DEVANAGARI_EXTENDED_START && code <= DEVANAGARI_END) return true;
  return code === ZERO_WIDTH_JOINER || code === ZERO_WIDTH_NON_JOINER;
}

export function readWord(text: string, start: number): number {
  let end = start;
  while (isWordCharacter(text.charCodeAt(end))) end += 1;
  return end;
}

/** Spaces, tabs and no-break spaces; a newline ends the phrase so lines are not fused. */
export function skipBlanks(text: string, start: number): number {
  let end = start;
  for (;;) {
    const code = text.charCodeAt(end);
    if (code !== 0x20 && code !== 0x09 && code !== 0xa0) return end;
    end += 1;
  }
}

const UNITS = table<number>([
  [['sau', 'सौ'], HUNDRED],
  [['lakh', 'lakhs', 'lac', 'lacs', 'लाख'], LAKH],
  [['crore', 'crores', 'cr', 'karod', 'करोड़', 'करोड'], CRORE],
  [['hazaar', 'hazar', 'hajar', 'hazaars', 'हज़ार', 'हजार'], THOUSAND],
]);

// A bare "k" or "l" is only a unit glued to its number ("800k", "1.9L"); on its own after
// a space it would turn "5 l of water" or a stray letter into money.
const ATTACHED_UNITS = table<number>([
  [['k'], THOUSAND],
  [['l'], LAKH],
]);

const NUMERALS = table<number>([
  [['ek', 'एक'], 1],
  [['do', 'दो'], 2],
  [['teen', 'tin', 'तीन'], 3],
  [['char', 'chaar', 'चार'], 4],
  [['paanch', 'panch', 'paach', 'पाँच', 'पांच'], 5],
  [['chhe', 'chhah', 'chhay', 'छह', 'छः'], 6],
  [['saat', 'सात'], 7],
  [['aath', 'ath', 'आठ'], 8],
  [['nau', 'नौ'], 9],
  [['das', 'दस'], 10],
  [['bees', 'bis', 'बीस'], 20],
  [['tees', 'tis', 'तीस'], 30],
  [['chalis', 'chaalis', 'chalees', 'chaalees', 'चालीस'], 40],
  [['pachaas', 'pachas', 'पचास'], 50],
  [['saath', 'sath', 'साठ'], 60],
  [['sattar', 'सत्तर'], 70],
  [['assi', 'assee', 'अस्सी'], 80],
  [['nabbe', 'nabbey', 'नब्बे'], 90],
]);

const FRACTIONS = table<Quantity>([
  [['dedh', 'डेढ़', 'डेढ'], { quarters: 6 }],
  [['dhai', 'dhaai', 'ढाई'], { quarters: 10 }],
  [['sava', 'सवा'], { quarters: 5 }],
]);

// "saadhe teen" is three and a half; "paune do" is a quarter short of two.
const PREFIXES = table<Prefix>([
  [['saadhe', 'sadhe', 'saade', 'साढ़े', 'साढे'], { kind: 'prefix', offsetQuarters: 2 }],
  [['paune', 'paun', 'पौने', 'पौन'], { kind: 'prefix', offsetQuarters: -1 }],
]);

export function lookupUnit(normalized: string): number | undefined {
  return UNITS.get(normalized);
}

export function lookupAttachedUnit(normalized: string): number | undefined {
  return UNITS.get(normalized) ?? ATTACHED_UNITS.get(normalized);
}

/** A whole number word (one to ten, or a ten from twenty to ninety), or undefined. */
export function lookupNumeral(normalized: string): number | undefined {
  return NUMERALS.get(normalized);
}

/** A word that is a fixed quantity by itself: a numeral, dedh, dhai or sava. */
export function lookupQuantity(normalized: string): Quantity | undefined {
  const numeral = NUMERALS.get(normalized);
  return numeral === undefined ? FRACTIONS.get(normalized) : { quarters: numeral * 4 };
}

export function lookupPrefix(normalized: string): Prefix | undefined {
  return PREFIXES.get(normalized);
}

// Words that join the two ends of a range ("do ya teen lakh", "do se teen lakh").
const RANGE_WORDS: ReadonlySet<string> = new Set(
  ['ya', 'se', 'aur', 'or', 'या', 'से', 'और'].map((word) => normalizeWord(word)),
);
const HYPHEN = 0x2d;
const EN_DASH = 0x2013;
const SLASH = 0x2f;

/**
 * True when a bare number word between `from` and `to` and its neighbouring amount are the two
 * ends of one range. A joiner (a hyphen, an en dash, a slash, or ya, se, aur, or) links them
 * whatever the amount looks like; blanks alone link a word before an amount only when the
 * amount is spelled in words ("do teen lakh"), because before digits the word is usually not a
 * number at all: "ke saath 200 log" is "with 200 people" and "we can do 8 lakh" is English.
 */
export function joinsRange(text: string, from: number, to: number, inWords: boolean): boolean {
  let index = skipBlanks(text, from);
  let joined = false;
  const code = text.charCodeAt(index);
  if (code === HYPHEN || code === EN_DASH || code === SLASH) {
    index = skipBlanks(text, index + 1);
    joined = true;
  } else if (index < to && isWordCharacter(code)) {
    const end = readWord(text, index);
    if (RANGE_WORDS.has(normalizeWord(text.slice(index, end)))) {
      index = skipBlanks(text, end);
      joined = true;
    }
  }
  return index === to && (joined || inWords);
}
