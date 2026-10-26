// The one place a template turns a fact into text. Amounts and dates are formatted here and
// nowhere else, so every digit in a message traces to a value in the facts.

import { partsOf } from '@/core/calendar/day-number';
import type { IsoDate } from '@/core/calendar/day-number';
import { formatRupeeWords, formatRupees } from '@/core/rupees/format';
import type { Language } from '@/core/rupees/format';
import { parseAmount } from '@/core/rupees/parse';

import { ENGLISH } from './pack-en';
import { HINDI } from './pack-hi';
import type { PhrasePack } from './phrase-pack';

const PACKS: Readonly<Record<Language, PhrasePack>> = { en: ENGLISH, hi: HINDI };

export function packFor(language: Language): PhrasePack {
  return PACKS[language];
}

/**
 * "Rs 7,50,000 (7.5 lakh)". The word form is a rounded reading aid, so it is added only when it
 * reads back as exactly the same rupees; "7.5 lakh" beside Rs 7,45,000 would put a figure in
 * the message that is not in the facts.
 */
export function moneyText(inr: number, language: Language): string {
  const exact = formatRupees(inr);
  const words = formatRupeeWords(Math.abs(inr), language);
  if (words === null) return exact;
  const read = parseAmount(words);
  return read.kind === 'amount' && read.inr === Math.abs(inr) ? `${exact} (${words})` : exact;
}

export function dateText(date: IsoDate, language: Language): string {
  const { year, month, day } = partsOf(date);
  const name = packFor(language).months[month - 1] ?? String(month);
  return `${String(day)} ${name} ${String(year)}`;
}

export function localized(
  text: { readonly en: string; readonly hi: string },
  language: Language,
): string {
  return text[language];
}
