import { describe, expect, it } from 'vitest';

import { formatRupeeWords, formatRupees, groupIndian } from '@/core/rupees/format';

// Built from code points so the test does not depend on how an editor composes the nukta:
// the crore word is the decomposed pair U+0921 U+093C, as NFC produces.
const LAKH_HI = 'लाख';
const CRORE_HI = 'करोड़';

describe('groupIndian uses the 2-2-3 grouping', () => {
  it.each<[number, string]>([
    [0, '0'],
    [7, '7'],
    [999, '999'],
    [1_000, '1,000'],
    [12_345, '12,345'],
    [99_999, '99,999'],
    [100_000, '1,00,000'],
    [750_000, '7,50,000'],
    [1_234_567, '12,34,567'],
    [12_345_678, '1,23,45,678'],
    [100_000_000, '10,00,00,000'],
    [1_000_000_000, '1,00,00,00,000'],
    [Number.MAX_SAFE_INTEGER, '9,00,71,99,25,47,40,991'],
  ])('%i is written %s', (value, expected) => {
    expect(groupIndian(value)).toBe(expected);
  });
});

describe('formatRupees', () => {
  it.each<[number, string]>([
    [0, 'Rs 0'],
    [7, 'Rs 7'],
    [999, 'Rs 999'],
    [1_000, 'Rs 1,000'],
    [12_345, 'Rs 12,345'],
    [100_000, 'Rs 1,00,000'],
    [750_000, 'Rs 7,50,000'],
    [800_000, 'Rs 8,00,000'],
    [12_345_678, 'Rs 1,23,45,678'],
    [100_000_000, 'Rs 10,00,00,000'],
  ])('%i renders as %s, the same in both languages', (inr, expected) => {
    expect(formatRupees(inr)).toBe(expected);
  });

  it('keeps the minus in front of a negative (under-budget) amount', () => {
    expect(formatRupees(-120_000)).toBe('-Rs 1,20,000');
    expect(formatRupees(-1)).toBe('-Rs 1');
  });

  it('uses Western digits and never the rupee sign', () => {
    expect(formatRupees(750_000)).toMatch(/^Rs [0-9,]+$/);
    expect(formatRupees(750_000)).not.toContain('₹');
  });

  it.each<[string, number]>([
    ['a fraction', 12.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['an unsafe integer', Number.MAX_SAFE_INTEGER + 2],
  ])('prints a visible placeholder for %s instead of a wrong figure', (_name, inr) => {
    expect(formatRupees(inr)).toBe('Rs ?');
  });
});

describe('formatRupeeWords', () => {
  it.each<[number, string, string]>([
    [750_000, '7.5 lakh', `7.5 ${LAKH_HI}`],
    [800_000, '8 lakh', `8 ${LAKH_HI}`],
    [100_000, '1 lakh', `1 ${LAKH_HI}`],
    [190_000, '1.9 lakh', `1.9 ${LAKH_HI}`],
    [12_000_000, '1.2 crore', `1.2 ${CRORE_HI}`],
    [12_345_678, '1.2 crore', `1.2 ${CRORE_HI}`],
    [10_000_000, '1 crore', `1 ${CRORE_HI}`],
    [100_000_000, '10 crore', `10 ${CRORE_HI}`],
    [25_000_000_000, '2,500 crore', `2,500 ${CRORE_HI}`],
  ])('%i reads %s in English and the Hindi equivalent', (inr, english, hindi) => {
    expect(formatRupeeWords(inr, 'en')).toBe(english);
    expect(formatRupeeWords(inr, 'hi')).toBe(hindi);
  });

  it.each<[string, number, string]>([
    ['just below half a tenth rounds down', 704_999, '7 lakh'],
    ['exactly half a tenth rounds up', 705_000, '7.1 lakh'],
    ['a tenth boundary', 710_000, '7.1 lakh'],
    ['rounding up to a whole lakh drops the .0', 799_999, '8 lakh'],
    ['rounding up across a lakh digit', 849_999, '8.5 lakh'],
    ['the last value before 100 lakh', 9_949_999, '99.5 lakh'],
    ['just under 100 lakh is promoted to crore', 9_995_000, '1 crore'],
    ['exactly 100 lakh', 10_000_000, '1 crore'],
    ['a crore rounds half up', 12_500_000, '1.3 crore'],
    ['a crore just below half rounds down', 12_499_999, '1.2 crore'],
  ])('%s', (_name, inr, expected) => {
    expect(formatRupeeWords(inr, 'en')).toBe(expected);
  });

  it.each([0, 1, 999, 50_000, 99_999])('gives no word below one lakh: %i', (inr) => {
    expect(formatRupeeWords(inr, 'en')).toBeNull();
    expect(formatRupeeWords(inr, 'hi')).toBeNull();
  });

  it('rounds a negative by magnitude and keeps the sign in front', () => {
    expect(formatRupeeWords(-750_000, 'en')).toBe('-7.5 lakh');
    expect(formatRupeeWords(-705_000, 'en')).toBe('-7.1 lakh');
    expect(formatRupeeWords(-12_000_000, 'hi')).toBe(`-1.2 ${CRORE_HI}`);
    expect(formatRupeeWords(-50_000, 'en')).toBeNull();
  });

  it('gives null for input that is not a whole rupee amount', () => {
    expect(formatRupeeWords(750_000.5, 'en')).toBeNull();
    expect(formatRupeeWords(Number.NaN, 'en')).toBeNull();
  });

  it('uses Western digits in the Hindi words', () => {
    expect(formatRupeeWords(750_000, 'hi')).toMatch(/^7\.5 /);
  });
});
