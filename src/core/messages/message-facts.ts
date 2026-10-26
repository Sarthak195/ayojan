// Assembles the facts of the latest revision. Everything a message may say, whether a
// template or a model draft, comes from this one object, so "every number is in the facts"
// is a checkable rule and not a promise.

import type { QuestionId } from '@/schemas/generated/ids';

import type { MessageFacts, MessageFactsInput, VendorFact } from './fact-types';

// Questions that only make sense after something changed. At version 1 nothing changed, so a
// vendor is not asked to re-confirm (the other questions, such as an unclear tax rate, stay).
const RECONFIRMATION_IDS: ReadonlySet<QuestionId> = new Set<QuestionId>([
  'date-reconfirmation',
  'guest-count-reconfirmation',
  'venue-capacity',
  'guest-cap-exceeded',
]);

export function isReconfirmationQuestion(id: QuestionId): boolean {
  return RECONFIRMATION_IDS.has(id);
}

function distinct<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function cleanVendor(vendor: VendorFact, hasRevision: boolean): VendorFact {
  const ids = distinct(vendor.questionIds);
  return {
    ...vendor,
    questionIds: hasRevision ? ids : ids.filter((id) => !isReconfirmationQuestion(id)),
  };
}

/**
 * Builds the facts. A plan with no revision (`before` null) gets a summary and no vendor
 * re-confirmation; a vendor left with no question has nothing to be messaged about.
 */
export function buildMessageFacts(input: MessageFactsInput): MessageFacts {
  const hasRevision = input.before !== null;
  const vendors = input.vendors
    .map((vendor) => cleanVendor(vendor, hasRevision))
    .filter((vendor) => vendor.questionIds.length > 0);
  return {
    ...input,
    vendors,
    unclearQuotes: input.unclearQuotes.filter((quote) => quote.fields.length > 0),
    diet: distinct(input.diet),
    venueLimits: distinct(input.venueLimits),
    gapInr: input.now.projectedInr - input.now.budgetInr,
    hasRevision,
  };
}

/** The re-confirmation questions the facts ask of any vendor, in first-seen order. */
export function reconfirmationQuestionIds(facts: MessageFacts): QuestionId[] {
  return distinct(
    facts.vendors.flatMap((vendor) => vendor.questionIds).filter(isReconfirmationQuestion),
  );
}
