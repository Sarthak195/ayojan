// One message per vendor, built from question ids and the wording in data/vendor-questions.yaml.
// A vendor message holds questions only, never a price: the vendor supplies those.

import type { Language } from '@/core/rupees/format';
import type { QuestionId } from '@/schemas/generated/ids';
import type { Category } from '@/schemas/readings/vocabulary';

import type { LocalText, MessageFacts, VendorFact } from './fact-types';
import { dateText, localized, packFor } from './render-values';

/** A question row as the data loader provides it; extra fields on the row are ignored. */
export interface QuestionText {
  /** A plain string: the loader types row ids as strings; unknown ids are simply never asked. */
  readonly id: string;
  readonly en: string;
  readonly hi: string;
}

export interface VendorMessage {
  readonly vendor: LocalText;
  readonly category: Category;
  /** The questions that made it into the message, in order. */
  readonly questionIds: readonly QuestionId[];
  readonly lines: readonly string[];
}

// A question that needs a capacity is dropped when none was entered, so a placeholder is never
// sent to a vendor unfilled; the same goes for any placeholder this code does not know.
function fillQuestion(
  template: string,
  facts: MessageFacts,
  vendor: VendorFact,
  language: Language,
): string | null {
  if (template.includes('{capacity}') && vendor.bookedCapacity === null) return null;
  const filled = template
    .replaceAll('{guests}', String(facts.now.guests))
    .replaceAll('{capacity}', String(vendor.bookedCapacity ?? ''))
    .replaceAll('{date}', dateText(facts.now.eventDate, language));
  return filled.includes('{') || filled.includes('}') ? null : filled;
}

function messageFor(
  vendor: VendorFact,
  facts: MessageFacts,
  questions: ReadonlyMap<string, QuestionText>,
  language: Language,
): VendorMessage | null {
  const pack = packFor(language);
  const asked: { id: QuestionId; text: string }[] = [];
  for (const id of vendor.questionIds) {
    const row = questions.get(id);
    const text =
      row === undefined ? null : fillQuestion(localized(row, language), facts, vendor, language);
    if (text !== null) asked.push({ id, text });
  }
  if (asked.length === 0) return null;
  const date = dateText(facts.now.eventDate, language);
  const occasion = pack.occasion[facts.occasion];
  return {
    vendor: vendor.label,
    category: vendor.category,
    questionIds: asked.map((question) => question.id),
    lines: [
      pack.vendor.greeting,
      pack.vendor.intro(occasion, date, facts.now.guests),
      pack.vendor.ask,
      ...asked.map((question) => `- ${question.text}`),
      pack.vendor.thanks,
    ],
  };
}

/** One message for each vendor that has at least one askable question. */
export function vendorMessages(
  facts: MessageFacts,
  questions: readonly QuestionText[],
  language: Language,
): VendorMessage[] {
  const byId = new Map(questions.map((question) => [question.id, question] as const));
  return facts.vendors.flatMap((vendor) => {
    const message = messageFor(vendor, facts, byId, language);
    return message === null ? [] : [message];
  });
}
