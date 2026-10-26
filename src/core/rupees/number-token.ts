// Reads one numeral (digits, thousands separators, a decimal part) from text. Hand-written
// rather than a regex so the cost is provably linear: the only look-ahead is a bounded
// number of separator groups, and every other character is consumed exactly once.

const DEVANAGARI_ZERO = 0x0966;
const DEVANAGARI_NINE = 0x096f;
const ASCII_ZERO = 0x30;
const ASCII_NINE = 0x39;
const COMMA = 0x2c;
const DOT = 0x2e;

// A numeral longer than this many separator groups is far beyond 2^53 whichever grouping
// it uses, so stopping early changes no valid result and bounds the look-ahead per start.
const MAX_GROUPS = 8;

export interface NumberToken {
  readonly integer: string;
  readonly fraction: string;
  readonly end: number;
}

/** The value 0 to 9 of an ASCII or Devanagari digit, or -1 for any other character. */
export function digitValue(code: number): number {
  if (code >= ASCII_ZERO && code <= ASCII_NINE) return code - ASCII_ZERO;
  if (code >= DEVANAGARI_ZERO && code <= DEVANAGARI_NINE) return code - DEVANAGARI_ZERO;
  return -1;
}

function readDigits(text: string, start: number): { digits: string; end: number } {
  const parts: string[] = [];
  let end = start;
  for (;;) {
    const value = digitValue(text.charCodeAt(end));
    if (value < 0) break;
    parts.push(String(value));
    end += 1;
  }
  return { digits: parts.join(''), end };
}

// Counts digits after a separator but never past four, because a group is only valid at
// two or three digits; this keeps a long run after a comma from being re-read per group.
function groupLengthAt(text: string, start: number): number {
  let length = 0;
  while (length < 4 && digitValue(text.charCodeAt(start + length)) >= 0) length += 1;
  return length;
}

type GroupMode = 'start' | 'western' | 'twos';

// Western grouping is 1,234,567 (all groups of three); Indian is 12,34,567 (twos, then a
// final three). Anything else, such as "10,20,30" in a list, is not one number, so the
// scan keeps only the longest prefix that is valid and the rest is read separately.
function groupedEnd(text: string, start: number, leadLength: number): number {
  let position = start;
  let validEnd = start;
  let leadMax = 0;
  let mode: GroupMode = 'start';
  for (let group = 0; group < MAX_GROUPS; group += 1) {
    if (text.charCodeAt(position) !== COMMA) break;
    const length = groupLengthAt(text, position + 1);
    if (length !== 2 && length !== 3) break;
    if (mode === 'western' && length !== 3) break;
    position += 1 + length;
    if (mode === 'twos' || (mode === 'start' && length === 2)) {
      mode = 'twos';
      if (length === 3) {
        validEnd = position;
        leadMax = 2;
        break;
      }
      continue;
    }
    mode = 'western';
    validEnd = position;
    leadMax = 3;
  }
  return validEnd > start && leadLength <= leadMax ? validEnd : start;
}

export function readNumber(text: string, start: number): NumberToken {
  const lead = readDigits(text, start);
  const groupsEnd = groupedEnd(text, lead.end, lead.digits.length);
  const integer = groupsEnd > lead.end ? readGroupedDigits(text, start, groupsEnd) : lead.digits;
  let end = Math.max(lead.end, groupsEnd);
  let fraction = '';
  if (text.charCodeAt(end) === DOT && digitValue(text.charCodeAt(end + 1)) >= 0) {
    const decimals = readDigits(text, end + 1);
    fraction = decimals.digits;
    end = decimals.end;
  }
  return { integer, fraction, end };
}

function readGroupedDigits(text: string, start: number, end: number): string {
  const parts: string[] = [];
  for (let index = start; index < end; index += 1) {
    const value = digitValue(text.charCodeAt(index));
    if (value >= 0) parts.push(String(value));
  }
  return parts.join('');
}
