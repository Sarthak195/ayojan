// Assembles the facts of the latest revision. Everything a message may say, whether a
// template or a model draft, comes from this one object, so "every number is in the facts"
// is a checkable rule and not a promise.

import type { QuestionId } from '@/schemas/generated/ids';

import type { AtRiskTask, MessageFacts, MessageFactsInput, VendorFact } from './fact-types';

/** How many tasks a message names; the rest are counted, so the update stays short. */
export const ATTENTION_SHOWN = 3;

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

// The plan lists tasks in dependency order, which is not urgency: a Late task can sit behind
// three At-risk ones. Late first, then the earliest latest-finish (ISO dates sort as text).
function mostUrgent(tasks: readonly AtRiskTask[]): AtRiskTask[] {
  const rank = (task: AtRiskTask): number => (task.status === 'late' ? 0 : 1);
  return [...tasks]
    .sort((a, b) => rank(a) - rank(b) || (a.dueBy < b.dueBy ? -1 : a.dueBy > b.dueBy ? 1 : 0))
    .slice(0, ATTENTION_SHOWN);
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
    atRisk: mostUrgent(input.atRisk),
    moreAtRiskCount: Math.max(0, input.atRisk.length - ATTENTION_SHOWN),
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
