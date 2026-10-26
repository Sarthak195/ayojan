import { describe, expect, it } from 'vitest';

import { canonicalise, originalRange, RUPEE_MARKER } from '@/core/grounding/canonical-text';

// Dashes, curly quotes and emoji are written as escapes: the repository bans the em dash
// character in source and fixtures (NFR-CQ-11), and escapes make every test input visible.
const PARTY = '\u{1F389}';
const THUMBS_UP_MEDIUM = '\u{1F44D}\u{1F3FD}';
const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}';
const INDIA_FLAG = '\u{1F1EE}\u{1F1F3}';
const DEVANAGARI_ZA_PRECOMPOSED = 'ज़';
const DEVANAGARI_ZA_DECOMPOSED = 'ज़';

function canonicalOf(text: string): string {
  return canonicalise(text).text;
}

// Maps the first occurrence of `needle` in the canonical text back to the original slice.
function originalSliceOf(text: string, needle: string): string {
  const canonical = canonicalise(text);
  const at = canonical.text.indexOf(needle);
  expect(at).toBeGreaterThanOrEqual(0);
  const range = originalRange(canonical, at, at + needle.length);
  return text.slice(range.start, range.end);
}

describe('canonicalise folds the spelling differences a phone or chat app adds', () => {
  describe.each<[string, string, string]>([
    ['curly double quotes to ASCII', '“8 lakh”', '"8 lakh"'],
    ['curly single quotes to ASCII', '‘dhol’ zaroor', "'dhol' zaroor"],
    ['low and reversed quotes to ASCII', '„budget‟', '"budget"'],
    ['guillemets to ASCII', '«shaadi»', '"shaadi"'],
    ['em dash to hyphen', 'Feb—March', 'Feb-March'],
    ['en dash to hyphen', '200–250 log', '200-250 log'],
    ['minus sign to hyphen', '−20', '-20'],
    ['collapsed spaces and tabs', 'budget \t  8   lakh', 'budget 8 lakh'],
    ['line breaks become one space', 'budget\n\n8 lakh\r\n200 log', 'budget 8 lakh 200 log'],
    ['no-break and narrow spaces', '8 lakh budget', '8 lakh budget'],
    ['leading and trailing blanks trimmed', '  \n budget  \t', 'budget'],
    ['zero-width space dropped inside a word', 'la​kh', 'lakh'],
    ['direction marks dropped', '‎8 lakh‏', '8 lakh'],
  ])('%s', (_name, input, expected) => {
    it(`reads ${JSON.stringify(input)} as ${JSON.stringify(expected)}`, () => {
      expect(canonicalOf(input)).toBe(expected);
    });
  });
});

describe('canonicalise unifies every rupee marker', () => {
  describe.each<[string, string, string]>([
    ['Rs with a space', 'Rs 8,00,000', 'Rs 8,00,000'],
    ['lowercase rs', 'rs 8,00,000', 'Rs 8,00,000'],
    ['uppercase RS', 'RS 500', 'Rs 500'],
    ['Rs with a dot', 'Rs. 8 lac', 'Rs 8 lac'],
    ['rs with a dot and no space', 'rs.8L', 'Rs 8L'],
    ['Rs attached to digits', 'Rs8L', 'Rs 8L'],
    ['INR', 'INR 8 lakh', 'Rs 8 lakh'],
    ['lowercase inr attached', 'inr500', 'Rs 500'],
    ['rupee sign attached', '₹8,00,000', 'Rs 8,00,000'],
    ['rupee sign with a space', '₹ 500', 'Rs 500'],
    ['marker after the amount', '500rs only', '500 Rs only'],
    ['marker after the amount with a dot', '1300 Rs. per plate', '1300 Rs per plate'],
    ['marker inside brackets', '(₹500)', '(Rs 500)'],
  ])('%s', (_name, input, expected) => {
    it(`reads ${JSON.stringify(input)} as ${JSON.stringify(expected)}`, () => {
      expect(canonicalOf(input)).toBe(expected);
    });
  });

  describe.each<[string, string]>([
    ['a title', 'Mrs Sharma'],
    ['an invitation reply', 'RSVP by Friday'],
    ['a word ending in rs', 'two hours'],
    ['a word starting with rs', 'rsvp karo'],
    ['a word starting with inr', 'inrange'],
    ['a word ending in inr', 'Rainr'],
  ])('leaves %s alone', (_name, input) => {
    it(`keeps ${JSON.stringify(input)}`, () => {
      expect(canonicalOf(input)).toBe(input);
    });
  });

  it('spells the canonical marker as Rs', () => {
    expect(RUPEE_MARKER).toBe('Rs');
  });
});

describe('canonicalise removes WhatsApp stamps and sender names', () => {
  describe.each<[string, string, string]>([
    ['iOS stamp', '[26/10/26, 9:41 pm] Mausi: budget 8 lakh', 'budget 8 lakh'],
    ['iOS stamp with seconds', '[26/10/2026, 21:41:05] Papa: 200 log', '200 log'],
    ['iOS stamp with a narrow space', '[26/10/26, 9:41 pm] Mausi: haan', 'haan'],
    ['iOS stamp with dotted meridiem', '[26/10/26, 9:41 p.m.] Mausi: haan', 'haan'],
    ['Android stamp', '26/10/26, 9:41 pm - Mausi: budget 8 lakh', 'budget 8 lakh'],
    ['Android stamp with an en dash', '26/10/26, 9:41 pm – Mausi: haan', 'haan'],
    ['phone number as the sender', '[26/10/26, 9:41 pm] +91 98765 43210: haan', 'haan'],
    [
      'one stamp per line',
      '[26/10/26, 9:41 pm] Mausi: budget 8 lakh\n[26/10/26, 9:42 pm] Papa: 200 log',
      'budget 8 lakh 200 log',
    ],
    ['a direction mark before the stamp', '‎[26/10/26, 9:41 pm] Mausi: haan', 'haan'],
  ])('%s', (_name, input, expected) => {
    it(`reads ${JSON.stringify(input)} as ${JSON.stringify(expected)}`, () => {
      expect(canonicalOf(input)).toBe(expected);
    });
  });

  describe.each<[string, string]>([
    ['a stamp in the middle of a line', 'see [26/10/26, 9:41 pm] Mausi: x'],
    ['a system line with no sender colon', '[26/10/26, 9:41 pm] Messages are encrypted'],
    ['a date with no time', '[26/10/26] Mausi: haan'],
    ['a bracketed note', '[note] Mausi: haan'],
  ])('keeps %s', (_name, input) => {
    it(`keeps ${JSON.stringify(input)}`, () => {
      expect(canonicalOf(input)).toBe(input);
    });
  });
});

describe('canonicalise removes emoji but keeps script joiners', () => {
  describe.each<[string, string, string]>([
    ['a single emoji between words', `budget ${PARTY} 8 lakh`, 'budget 8 lakh'],
    ['an emoji touching a word', `8 lakh${PARTY}budget`, '8 lakh budget'],
    ['an emoji with a skin tone', `8 lakh ${THUMBS_UP_MEDIUM}`, '8 lakh'],
    ['a joined family sequence', `${FAMILY} 200 log`, '200 log'],
    ['a flag', `shaadi ${INDIA_FLAG}`, 'shaadi'],
    ['a keycap keeps its digit', '1️⃣ dhol', '1 dhol'],
    ['a heart with a presentation selector', 'pyaar ❤️', 'pyaar'],
    ['only emoji', `${PARTY}${PARTY}${FAMILY}`, ''],
  ])('%s', (_name, input, expected) => {
    it(`reads ${JSON.stringify(input)} as ${JSON.stringify(expected)}`, () => {
      expect(canonicalOf(input)).toBe(expected);
    });
  });

  it('keeps a zero-width joiner inside a Devanagari conjunct', () => {
    expect(canonicalOf('क्‍ष')).toBe('क्‍ष');
  });

  it('keeps a zero-width non-joiner inside a Devanagari word', () => {
    expect(canonicalOf('क्‌ष')).toBe('क्‌ष');
  });

  it('keeps the copyright sign, which reads as text', () => {
    expect(canonicalOf('© Sharma')).toBe('© Sharma');
  });
});

describe('canonicalise applies NFC', () => {
  it('reads the precomposed and decomposed nukta letter the same way', () => {
    expect(canonicalOf(DEVANAGARI_ZA_PRECOMPOSED)).toBe(canonicalOf(DEVANAGARI_ZA_DECOMPOSED));
  });

  it('reads both spellings of hazaar as one word', () => {
    const composed = `ह${DEVANAGARI_ZA_PRECOMPOSED}ार`;
    const decomposed = `ह${DEVANAGARI_ZA_DECOMPOSED}ार`;
    expect(canonicalOf(`50 ${composed}`)).toBe(canonicalOf(`50 ${decomposed}`));
  });

  it('composes a Latin letter and its accent', () => {
    expect(canonicalOf('café')).toBe('café');
  });

  it('composes Hangul jamo, which joins across characters', () => {
    expect(canonicalOf('가 x')).toBe('가 x');
  });
});

describe('canonicalise handles degenerate input', () => {
  it('returns empty text for empty input', () => {
    const canonical = canonicalise('');
    expect(canonical.text).toBe('');
    expect(canonical.starts).toEqual([]);
  });

  it('keeps a lone surrogate without throwing', () => {
    expect(canonicalOf('\uD800 x')).toBe('\uD800 x');
  });

  it('reads 2,000 characters in full', () => {
    const text = 'budget 8 lakh, '.repeat(134).slice(0, 2_000);
    expect(canonicalOf(text)).toBe(text.trim());
  });
});

describe('the offset map leads back to the original characters', () => {
  const SAMPLES = [
    '',
    '[26/10/26, 9:41 pm] Mausi: Budget “8 lakh” \u{1F389} rs.8L',
    `ह${DEVANAGARI_ZA_PRECOMPOSED}ार aur ह${DEVANAGARI_ZA_DECOMPOSED}ार`,
    `${FAMILY} ₹500 Mrs RSVP\n26/10/26, 9:42 pm - Papa: 200 log`,
    '\uD800 lone \uDC00',
    '각 jamo',
  ];

  it.each(SAMPLES)('maps every canonical unit inside the original for %j', (text) => {
    const canonical = canonicalise(text);
    expect(canonical.starts).toHaveLength(canonical.text.length);
    expect(canonical.ends).toHaveLength(canonical.text.length);
    canonical.starts.forEach((start, index) => {
      const end = canonical.ends[index] ?? -1;
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(text.length);
    });
  });

  it('never alters the original text', () => {
    const text = `[26/10/26, 9:41 pm] Mausi: “8 lakh” ${PARTY}`;
    const before = text.slice();
    const canonical = canonicalise(text);
    expect(canonical.original).toBe(before);
    expect(text).toBe(before);
  });

  it('highlights the original characters behind a chat-stamped quote', () => {
    const text = '[26/10/26, 9:41 pm] Mausi: Budget “8 lakh” hai';
    expect(originalSliceOf(text, '"8 lakh"')).toBe('“8 lakh”');
  });

  it('highlights the original rupee sign behind the canonical marker', () => {
    expect(originalSliceOf('rate ₹1300/plate', 'Rs 1300')).toBe('₹1300');
  });

  it('highlights the emoji the canonical copy skipped', () => {
    expect(originalSliceOf(`budget ${PARTY} 8 lakh`, 'budget 8')).toBe(`budget ${PARTY} 8`);
  });

  it('highlights the decomposed letters the user typed', () => {
    const typed = `50 ह${DEVANAGARI_ZA_DECOMPOSED}ार`;
    const canonicalWord = canonicalOf(`ह${DEVANAGARI_ZA_PRECOMPOSED}ार`);
    expect(originalSliceOf(typed, canonicalWord)).toBe(typed.slice(3));
  });

  it('maps an empty range to a point', () => {
    const canonical = canonicalise('abc');
    expect(originalRange(canonical, 1, 1)).toEqual({ start: 1, end: 1 });
  });
});
