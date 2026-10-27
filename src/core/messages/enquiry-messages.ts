// First messages to vendors the family has not heard from yet: one per category with no quote
// and no booking. The input type has no money in it at all, so no budget, split or price can
// reach the text; the vendor names the price, and the family keeps its ceiling to itself.

import type { IsoDate } from '@/core/calendar/day-number';
import type { Language } from '@/core/rupees/format';
import type { QuestionId } from '@/schemas/generated/ids';
import type { MustHave, Occasion } from '@/schemas/readings/vocabulary';

import type { LocalText } from './fact-types';
import type { EnquiryCategory } from './phrase-pack';
import { dateText, localized, packFor } from './render-values';

export interface EnquiryQuestion extends LocalText {
  readonly id: QuestionId;
}

export interface EnquiryVendor {
  readonly category: EnquiryCategory;
  readonly label: LocalText;
  /** Already chosen and filled by the plan layer, in the order to ask them. */
  readonly questions: readonly EnquiryQuestion[];
  /** Must-haves this vendor would supply that no question above already names. */
  readonly mustHaves: readonly MustHave[];
}

export interface EnquiryInput {
  readonly occasion: Occasion;
  readonly guests: number;
  readonly eventDate: IsoDate;
  /** The venue's capacity, when the family gave one; never sent to the venue itself. */
  readonly venueCapacity: number | null;
  readonly vendors: readonly EnquiryVendor[];
}

export interface EnquiryMessage {
  readonly vendor: LocalText;
  readonly category: EnquiryCategory;
  readonly questionIds: readonly QuestionId[];
  readonly lines: readonly string[];
}

function enquiryFor(
  vendor: EnquiryVendor,
  input: EnquiryInput,
  language: Language,
): EnquiryMessage {
  const pack = packFor(language);
  const words = pack.enquiry;
  const lines = [
    pack.vendor.greeting,
    words.intro(
      pack.occasion[input.occasion],
      dateText(input.eventDate, language),
      input.guests,
      words.seeking[vendor.category],
    ),
  ];
  // A caterer or decorator plans around the hall's size; the venue already knows its own.
  if (input.venueCapacity !== null && vendor.category !== 'venue') {
    lines.push(words.venueHolds(input.venueCapacity));
  }
  if (vendor.mustHaves.length > 0) {
    lines.push(words.alsoWant(vendor.mustHaves.map((item) => words.mustHave[item]).join(', ')));
  }
  if (vendor.questions.length > 0) {
    lines.push(pack.vendor.ask, ...vendor.questions.map((q) => `- ${localized(q, language)}`));
  }
  lines.push(words.close);
  return {
    vendor: vendor.label,
    category: vendor.category,
    questionIds: vendor.questions.map((question) => question.id),
    lines,
  };
}

/** One enquiry per vendor category still to be approached, in the plan layer's order. */
export function enquiryMessages(input: EnquiryInput, language: Language): EnquiryMessage[] {
  return input.vendors.map((vendor) => enquiryFor(vendor, input, language));
}
