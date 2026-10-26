import { describe, expect, it } from 'vitest';

import { amountsIn, parseAmount, scanAmounts } from '@/core/rupees/parse';

function amountOf(text: string): number | 'unclear' {
  const parsed = parseAmount(text);
  return parsed.kind === 'amount' ? parsed.inr : 'unclear';
}

describe('parseAmount reads one Indian amount', () => {
  describe.each<[string, string, number]>([
    ['lakh with a space', '8 lakh', 800_000],
    ['lakhs plural', '8 lakhs', 800_000],
    ['lakh attached', '8lakh', 800_000],
    ['L suffix', '8L', 800_000],
    ['lowercase l suffix', '8l', 800_000],
    ['lac spelling', '8 lac', 800_000],
    ['lacs plural', '8 lacs', 800_000],
    ['Indian grouping', '8,00,000', 800_000],
    ['plain digits', '800000', 800_000],
    ['k suffix', '800k', 800_000],
    ['uppercase K suffix', '800K', 800_000],
    ['decimal lakh with L', '1.9L', 190_000],
    ['decimal lakh with word', '1.5 lakh', 150_000],
    ['half a lakh', '0.5 lakh', 50_000],
    ['trailing slash-dash', '1,90,000/-', 190_000],
    ['small k amount', '15k', 15_000],
    ['hazaar', '50 hazaar', 50_000],
    ['hazar spelling', '50 hazar', 50_000],
    ['crore', '2 crore', 20_000_000],
    ['cr abbreviation', '2 cr', 20_000_000],
    ['attached cr', '2cr', 20_000_000],
    ['decimal crore', '1.5 cr', 15_000_000],
    ['Western grouping', '1,300', 1_300],
    ['Western grouping with millions', '1,234,567', 1_234_567],
    ['Indian grouping to crores', '1,23,45,678', 12_345_678],
    ['per-plate rate', '1,300/plate', 1_300],
    ['per-plate rate without grouping', '1300/plate', 1_300],
    ['zero', '0', 0],
    ['leading zeros', '0008', 8],
    ['trailing zero decimals', '8.00 lakh', 800_000],
    ['mixed case unit', '8 LAKH', 800_000],
  ])('%s', (_name, text, expected) => {
    it(`reads "${text}" as ${String(expected)}`, () => {
      expect(amountOf(text)).toBe(expected);
    });
  });

  describe.each<[string, string, number]>([
    ['Rs prefix', 'Rs 8,00,000', 800_000],
    ['Rs. prefix with lac', 'Rs. 8 lac', 800_000],
    ['rs lowercase with L', 'rs 8L', 800_000],
    ['Rs with no space', 'Rs8L', 800_000],
    ['INR prefix', 'INR 8 lakh', 800_000],
    ['rupee sign', '₹8,00,000', 800_000],
    ['rupee sign with a space', '₹ 8 lakh', 800_000],
    ['sentence around the amount', 'budget is Rs 8 lakh only', 800_000],
  ])('currency marker: %s', (_name, text, expected) => {
    it(`reads "${text}" as ${String(expected)}`, () => {
      expect(amountOf(text)).toBe(expected);
    });
  });

  describe.each<[string, string, number]>([
    ['Devanagari digit and word', '८ लाख', 800_000],
    ['Devanagari grouped digits', '१,९०,०००', 190_000],
    ['Devanagari thousand, composed nukta', '५० हज़ार', 50_000],
    ['Devanagari thousand, decomposed nukta', '५० हज़ार', 50_000],
    ['Devanagari thousand, no nukta', '५० हजार', 50_000],
    ['Devanagari crore, composed nukta', '२ करोड़', 20_000_000],
    ['Devanagari crore, decomposed nukta', '२ करोड़', 20_000_000],
    ['Devanagari decimal', '१.५ लाख', 150_000],
    ['Devanagari digits plain', '८०००००', 800_000],
  ])('Devanagari: %s', (_name, text, expected) => {
    it(`reads it as ${String(expected)}`, () => {
      expect(amountOf(text)).toBe(expected);
    });
  });

  describe.each<[string, string, number]>([
    ['do lakh', 'do lakh', 200_000],
    ['dedh lakh', 'dedh lakh', 150_000],
    ['dhai lakh', 'dhai lakh', 250_000],
    ['sava lakh', 'sava lakh', 125_000],
    ['saadhe teen lakh', 'saadhe teen lakh', 350_000],
    ['paune do lakh', 'paune do lakh', 175_000],
    ['ek lakh', 'ek lakh', 100_000],
    ['das lakh', 'das lakh', 1_000_000],
    ['aath lakh', 'aath lakh', 800_000],
    ['teen hazaar', 'teen hazaar', 3_000],
    ['dedh hazaar', 'dedh hazaar', 1_500],
    ['paanch crore', 'paanch crore', 50_000_000],
    ['saadhe char crore', 'saadhe char crore', 45_000_000],
    ['saadhe with digits', 'saadhe 3 lakh', 350_000],
    ['paune with digits', 'paune 2 lakh', 175_000],
    ['capital letters', 'Dedh Lakh', 150_000],
    ['alternate spelling sadhe', 'sadhe teen lakh', 350_000],
    ['Devanagari do lakh', 'दो लाख', 200_000],
    ['Devanagari dedh lakh, composed', 'डेढ़ लाख', 150_000],
    ['Devanagari dedh lakh, decomposed', 'डेढ़ लाख', 150_000],
    ['Devanagari dhai lakh', 'ढाई लाख', 250_000],
    ['Devanagari sava lakh', 'सवा लाख', 125_000],
    ['Devanagari saadhe teen lakh', 'साढ़े तीन लाख', 350_000],
    ['Devanagari paune do lakh', 'पौने दो लाख', 175_000],
    ['Devanagari aath lakh', 'आठ लाख', 800_000],
  ])('Hindi number words (D34): %s', (_name, text, expected) => {
    it(`reads "${text}" as ${String(expected)}`, () => {
      expect(amountOf(text)).toBe(expected);
    });
  });

  describe.each<[string, string]>([
    ['empty string', ''],
    ['whitespace only', '   \n\t'],
    ['no digits at all', 'budget bahut kam hai'],
    ['English number words', 'eight lakh'],
    ['English number words with a unit', 'five thousand'],
    ['lakh with no number', 'lakh'],
    ['a lone k', 'k'],
    ['a lone L', 'L'],
    ['a Hindi word outside the table', 'pachaas hazaar'],
    ['Hindi word outside the table, Devanagari', 'पचास हजार'],
    ['a table word with no unit', 'dedh'],
    ['a table word before the wrong word', 'do log'],
    ['saadhe with no whole number', 'saadhe lakh'],
    ['punctuation only', '/-'],
    ['emoji only', '🎉🎉'],
  ])('unclear, never guessed: %s', (_name, text) => {
    it(`gives unclear for ${JSON.stringify(text)}`, () => {
      expect(amountOf(text)).toBe('unclear');
    });
  });

  it('names the reason when it is unclear', () => {
    expect(parseAmount('')).toEqual({ kind: 'unclear', reason: 'empty' });
    expect(parseAmount('eight lakh')).toEqual({ kind: 'unclear', reason: 'no-amount' });
    expect(parseAmount('8 lakh or 9 lakh')).toEqual({ kind: 'unclear', reason: 'several-amounts' });
    expect(parseAmount('99999999999 crore')).toEqual({ kind: 'unclear', reason: 'too-large' });
    expect(parseAmount('12.5')).toEqual({ kind: 'unclear', reason: 'fractional' });
  });
});

describe('scanAmounts finds every amount in a longer text', () => {
  it('yields both amounts of a two-amount string, in order, with positions', () => {
    const text = 'budget 8 lakh, actually 9 lakh dena padega';
    const hits = scanAmounts(text);
    expect(hits).toEqual([
      { kind: 'amount', inr: 800_000, start: 7, end: 13 },
      { kind: 'amount', inr: 900_000, start: 24, end: 30 },
    ]);
    expect(text.slice(7, 13)).toBe('8 lakh');
  });

  it('returns a lagbhag guest count as the number 200', () => {
    expect(amountsIn('lagbhag 200 log aayenge')).toEqual([200]);
  });

  it('returns a ten-digit phone number as a plain number', () => {
    expect(amountsIn('call 9876543210 for the venue')).toEqual([9_876_543_210]);
  });

  it('finds Hindi words inside a Hinglish sentence', () => {
    expect(amountsIn('photography pe dedh lakh aur decor pe 50 hazaar')).toEqual([150_000, 50_000]);
  });

  it('does not read a comma-separated list as one number', () => {
    expect(amountsIn('10,20,30')).toEqual([10, 20, 30]);
  });

  it('does not merge grouped digits whose pattern is neither Indian nor Western', () => {
    expect(amountsIn('1,2345')).toEqual([1, 2345]);
    expect(amountsIn('1234,567')).toEqual([1234, 567]);
    // 1,23,456 is a valid Indian grouping, so the trailing ",789" is a separate figure.
    expect(amountsIn('1,23,456,789')).toEqual([123_456, 789]);
  });

  it('reads an amount beside a date and a quantity without confusing them', () => {
    expect(amountsIn('26/02/2027, 250 guests, Rs 8,00,000/-')).toEqual([26, 2, 2027, 250, 800_000]);
  });

  it('does not treat a unit glued to other letters as a unit', () => {
    expect(amountsIn('800kg rice')).toEqual([800]);
    expect(amountsIn('5 l water')).toEqual([5]);
  });

  it('keeps the same amount only once in amountsIn', () => {
    expect(amountsIn('8 lakh, yes 8L')).toEqual([800_000]);
  });

  it('reports an unusable figure with a reason rather than dropping it', () => {
    expect(scanAmounts('99999999999 crore')).toEqual([
      { kind: 'unusable', reason: 'too-large', start: 0, end: 17 },
    ]);
    expect(scanAmounts('1.2345678 lakh')).toEqual([
      { kind: 'unusable', reason: 'fractional', start: 0, end: 14 },
    ]);
  });

  it('refuses a 20-digit number as too large instead of returning Infinity or an unsafe integer', () => {
    const hits = scanAmounts('1'.repeat(20));
    expect(hits).toEqual([{ kind: 'unusable', reason: 'too-large', start: 0, end: 20 }]);
  });

  it('keeps fifteen significant digits and refuses a sixteenth', () => {
    expect(amountOf('999999999999999')).toBe(999_999_999_999_999);
    expect(amountOf('1000000000000000')).toBe('unclear');
    expect(amountOf('999999999999999 crore')).toBe('unclear');
  });

  it('never returns a non-integer or non-finite value', () => {
    const samples = [
      '1.5',
      '1.5k',
      '0.001 lakh',
      '3.3333333 cr',
      '1e9',
      '-5 lakh',
      '1,00,00,00,00,000 crore',
    ];
    for (const sample of samples) {
      for (const hit of scanAmounts(sample)) {
        if (hit.kind === 'amount') {
          expect(Number.isSafeInteger(hit.inr)).toBe(true);
        }
      }
    }
  });

  it('reads the amount in a negative-looking string as a positive figure (the minus is not part of it)', () => {
    expect(amountsIn('-5 lakh')).toEqual([500_000]);
  });
});
