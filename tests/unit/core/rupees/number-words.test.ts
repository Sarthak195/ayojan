import { describe, expect, it } from 'vitest';

import { amountsIn, parseAmount } from '@/core/rupees/parse';

function amountOf(text: string): number | 'unclear' {
  const parsed = parseAmount(text);
  return parsed.kind === 'amount' ? parsed.inr : 'unclear';
}

describe('sau and the tens join the closed table (D44)', () => {
  it.each([
    ['bees hazaar', 20_000],
    ['bis hazaar', 20_000],
    ['बीस हजार', 20_000],
    ['tees hazaar', 30_000],
    ['tis hazaar', 30_000],
    ['तीस हजार', 30_000],
    ['chalis hazaar', 40_000],
    ['chaalis hazaar', 40_000],
    ['chalees hazaar', 40_000],
    ['चालीस हजार', 40_000],
    ['pachaas hazaar', 50_000],
    ['pachas hazaar', 50_000],
    ['पचास हज़ार', 50_000],
    ['saath hazaar', 60_000],
    ['sath hazaar', 60_000],
    ['साठ हजार', 60_000],
    ['sattar hazaar', 70_000],
    ['सत्तर हजार', 70_000],
    ['assi hazaar', 80_000],
    ['assee hazaar', 80_000],
    ['अस्सी हजार', 80_000],
    ['nabbe hazaar', 90_000],
    ['nabbey hazaar', 90_000],
    ['नब्बे हजार', 90_000],
    ['pachaas lakh', 5_000_000],
    ['bees crore', 200_000_000],
  ])('reads %s as %i', (text, inr) => {
    expect(amountOf(text)).toBe(inr);
  });

  it.each([
    ['do sau', 200],
    ['aath sau', 800],
    ['दो सौ', 200],
    ['आठ सौ', 800],
    ['5 sau', 500],
    ['dedh sau', 150],
    ['dhai sau', 250],
    ['sava sau', 125],
    ['saadhe teen sau', 350],
    ['paune do sau', 175],
    ['डेढ़ सौ', 150],
    ['साढ़े तीन सौ', 350],
    ['पौने दो सौ', 175],
    ['saadhe pachaas hazaar', 50_500],
  ])('reads %s as %i with sau or a quarter prefix', (text, inr) => {
    expect(amountOf(text)).toBe(inr);
  });

  it('still needs a unit after a number word', () => {
    expect(amountOf('pachaas')).toBe('unclear');
    expect(amountOf('family ke saath')).toBe('unclear');
    expect(amountsIn('doston ke saath 200 log')).toEqual([200]);
    expect(amountsIn('we can do 8 lakh')).toEqual([800_000]);
    expect(amountsIn('what do you think')).toEqual([]);
  });

  it('leaves a word outside the table unread', () => {
    expect(amountOf('pachpan hazaar')).toBe('unclear');
    expect(amountOf('fifty thousand')).toBe('unclear');
  });

  it.each([
    ['do sau pachaas', 'a ten after sau'],
    ['do sau-pachaas', 'a hyphen'],
    ['दो सौ पचास', 'Devanagari'],
    ['bees-tees hazaar', 'a range of tens'],
    ['das hazaar paanch sau', 'two amounts'],
  ])('%s (%s) is several amounts, never one guessed figure', (text) => {
    expect(parseAmount(text)).toEqual({ kind: 'unclear', reason: 'several-amounts' });
  });
});
