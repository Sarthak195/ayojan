// The words the quote engine itself composes, in English and Hindi: vendor names, the
// explainer's row headings and the break-even sentence. They sit here, beside the numbers
// they carry, so a sentence can never be assembled from a number and a stale phrase elsewhere.

import { groupIndian as formatCount } from '../rupees/format';
import type { Language } from '../rupees/format';
import type { Category } from '@/schemas/readings/vocabulary';
import type { QuoteRecord, QuoteSlot } from '@/schemas/plan/quote-record';

import type { BreakEven } from './break-even';

const VENDOR_NOUN: Record<Category, Record<Language, string>> = {
  venue: { en: 'Venue', hi: 'वेन्यू' },
  catering: { en: 'Caterer', hi: 'कैटरर' },
  decor: { en: 'Decorator', hi: 'डेकोरेटर' },
  photo: { en: 'Photographer', hi: 'फ़ोटोग्राफ़र' },
  music: { en: 'Band', hi: 'बैंड' },
  invites: { en: 'Printer', hi: 'प्रिंटर' },
  contingency: { en: 'Vendor', hi: 'वेंडर' },
};

/** "Caterer A": a vendor is only ever its category and slot, never the pasted name. */
export function quoteLabel(
  quote: Pick<QuoteRecord, 'category' | 'id'>,
  language: Language,
): string {
  return `${VENDOR_NOUN[quote.category][language]} ${quote.id}`;
}

export const UNCONFIRMED_UNTIL_BOOKED: Record<Language, string> = {
  en: 'Unconfirmed until you book',
  hi: 'बुक करने तक पक्का नहीं',
};

export type RowKey =
  | 'included'
  | 'guestsCovered'
  | 'additionalCharges'
  | 'needsClarification'
  | 'comparableTotal'
  | 'againstSplit';

// The first four are the explainer's own headings (spec C5), word for word in English.
export function rowHeading(key: RowKey, guests: number, language: Language): string {
  const count = formatCount(guests);
  const headings: Record<RowKey, Record<Language, string>> = {
    included: { en: 'What is included', hi: 'क्या शामिल है' },
    guestsCovered: { en: 'How many guests are covered', hi: 'कितने मेहमान शामिल हैं' },
    additionalCharges: { en: 'Additional charges', hi: 'अलग से लगने वाला ख़र्च' },
    needsClarification: {
      en: 'What still needs clarification',
      hi: 'क्या अभी साफ़ होना बाक़ी है',
    },
    comparableTotal: {
      en: `Comparable total at ${count} guests`,
      hi: `${count} मेहमानों पर तुलना योग्य कुल`,
    },
    againstSplit: { en: 'Against your split', hi: 'आपके बँटवारे के मुक़ाबले' },
  };
  return headings[key][language];
}

export interface BreakEvenSentence {
  readonly headline: string | null;
  /** Said separately: the comparison stops where a lump sum stops covering guests. */
  readonly capNote: string | null;
}

type Labels = (slot: QuoteSlot) => string;

function gstClause(
  result: Extract<BreakEven, { kind: 'compared' }>,
  label: Labels,
  language: Language,
): string {
  const names = result.beforeGstOf.map(label);
  if (names.length === 0) return '';
  const joined = names.join(language === 'en' ? ' and ' : ' और ');
  return language === 'en' ? `, before ${joined}'s GST` : `, ${joined} के GST से पहले`;
}

function headline(
  result: Extract<BreakEven, { kind: 'compared' }>,
  label: Labels,
  language: Language,
): string | null {
  const gst = gstClause(result, label, language);
  if (result.above !== null) {
    const { cheaper, fromGuests } = result.above;
    const count = formatCount(fromGuests);
    return language === 'en'
      ? `${label(cheaper)} becomes cheaper from ${count} guests${gst}.`
      : `${label(cheaper)} ${count} मेहमानों से सस्ता हो जाता है${gst}।`;
  }
  if (result.below === null) return null;
  const { cheaper, belowGuests } = result.below;
  const count = formatCount(belowGuests);
  if (belowGuests === result.guests && result.cheaperNow !== null) {
    const now = label(result.cheaperNow);
    return language === 'en'
      ? `${now} is cheaper from now on, from ${count} guests${gst}.`
      : `${count} मेहमानों से अब आगे ${now} सस्ता है${gst}।`;
  }
  return language === 'en'
    ? `${label(cheaper)} becomes cheaper below ${count} guests${gst}.`
    : `${count} मेहमानों से कम पर ${label(cheaper)} सस्ता हो जाता है${gst}।`;
}

export function breakEvenSentence(
  result: BreakEven,
  label: Labels,
  language: Language,
): BreakEvenSentence {
  if (result.kind !== 'compared') return { headline: null, capNote: null };
  const cap = result.capEnd;
  const capNote =
    cap === null
      ? null
      : language === 'en'
        ? `${label(cap.quote)} covers up to ${formatCount(cap.cap)} guests, so the comparison ends there.`
        : `${label(cap.quote)} ${formatCount(cap.cap)} मेहमानों तक ही शामिल है, इसलिए तुलना वहीं रुकती है।`;
  return { headline: headline(result, label, language), capNote };
}
