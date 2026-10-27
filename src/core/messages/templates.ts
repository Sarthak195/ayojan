// The template messages the page shows: the family update, one message per vendor and one
// enquiry per vendor still to approach, in English or Hindi, each carrying the label that says code wrote it from the plan's numbers.

import type { Language } from '@/core/rupees/format';

import { enquiryMessages, type EnquiryInput, type EnquiryMessage } from './enquiry-messages';
import type { MessageFacts } from './fact-types';
import { familyUpdateLines } from './family-update';
import { packFor } from './render-values';
import { vendorMessages } from './vendor-messages';
import type { QuestionText, VendorMessage } from './vendor-messages';

export const TEMPLATE_LABEL_KEY = 'messages.templateLabel';

/** The English label, the form the requirements fix; Hindi is on the pack. */
export const TEMPLATE_LABEL_EN = 'Template, numbers from your plan';

export interface Labelled {
  readonly labelKey: typeof TEMPLATE_LABEL_KEY;
  readonly label: string;
  /** The same lines joined for a read-only text area and the Copy button. */
  readonly text: string;
}

export interface FamilyUpdateTemplate extends Labelled {
  readonly lines: readonly string[];
}

export interface VendorTemplate extends Labelled, VendorMessage {}

export interface EnquiryTemplate extends Labelled, EnquiryMessage {}

function labelled(lines: readonly string[], language: Language): Labelled {
  return {
    labelKey: TEMPLATE_LABEL_KEY,
    label: packFor(language).templateLabel,
    text: lines.join('\n'),
  };
}

export function familyUpdateTemplate(
  facts: MessageFacts,
  language: Language,
): FamilyUpdateTemplate {
  const lines = familyUpdateLines(facts, language);
  return { ...labelled(lines, language), lines };
}

export function vendorTemplates(
  facts: MessageFacts,
  questions: readonly QuestionText[],
  language: Language,
): VendorTemplate[] {
  return vendorMessages(facts, questions, language).map((message) => ({
    ...labelled(message.lines, language),
    ...message,
  }));
}

export function enquiryTemplates(input: EnquiryInput, language: Language): EnquiryTemplate[] {
  return enquiryMessages(input, language).map((message) => ({
    ...labelled(message.lines, language),
    ...message,
  }));
}
