// The facts as the drafting model reads them: every word already in the page's language and no
// internal id anywhere. A model echoes what it is given, so an id such as "step-free-access"
// once came back transliterated into a Hindi draft; it can only echo readable words if it is
// only given readable words. The numbers stay exactly as the facts hold them, so the draft
// check (fact-numbers) still accepts each one.

import type { Language } from '@/core/rupees/format';

import type { Headline, MessageFacts } from './fact-types';
import { reconfirmationQuestionIds } from './message-facts';
import { dateText, localized, packFor } from './render-values';
import { topicWords } from './required-mentions';
import { askedQuestions, questionsById, type QuestionText } from './vendor-messages';

interface ModelHeadline {
  readonly budgetInr: number;
  readonly guests: number;
  readonly eventDate: string;
  readonly projectedInr?: number;
  readonly priced: boolean;
}

// Before any price the projection is the budget itself, so handing it over invites "planned
// spending equals the budget" beside "nothing is priced". The date is written as the template
// writes it, so a draft that copies it is read back by the same check.
function headline(value: Headline, language: Language): ModelHeadline {
  const { budgetInr, guests, priced } = value;
  const eventDate = dateText(value.eventDate, language);
  return priced
    ? { budgetInr, guests, eventDate, projectedInr: value.projectedInr, priced }
    : { budgetInr, guests, eventDate, priced };
}

// A task goes over as the template's own wording for it, so the model needs no status code or
// start code to explain.
function attentionItems(facts: MessageFacts, language: Language): string[] {
  const pack = packFor(language);
  return facts.atRisk.map((task) => {
    const name = localized(task.name, language);
    const due = dateText(task.dueBy, language);
    return task.status === 'late'
      ? pack.sentences.lateItem(name, due, task.start)
      : pack.sentences.attentionItem(name, pack.status.atRisk, due);
  });
}

/**
 * The model-facing facts. A raise-budget lever carries `addsInr` and every other lever
 * `savesInr`, so the field name says what the lever id used to. `mustMention` holds the topic
 * words the draft check looks for (required-mentions), so the request names words, not ids.
 */
export function modelFacts(
  facts: MessageFacts,
  questions: readonly QuestionText[],
  language: Language,
): unknown {
  const pack = packFor(language);
  const rows = questionsById(questions);
  return {
    occasion: pack.occasion[facts.occasion],
    now: headline(facts.now, language),
    before: facts.before === null ? null : headline(facts.before, language),
    hasRevision: facts.hasRevision,
    daysToEvent: facts.daysToEvent,
    gapInr: facts.gapInr,
    levers: facts.levers.map((lever) => {
      const label = localized(lever.label, language);
      return lever.id === 'raise-budget'
        ? { label, addsInr: lever.effectInr }
        : { label, savesInr: lever.effectInr };
    }),
    atRisk: attentionItems(facts, language),
    moreAtRiskCount: facts.moreAtRiskCount,
    vendors: facts.vendors.map((vendor) => ({
      vendor: localized(vendor.label, language),
      questions: askedQuestions(vendor, facts, rows, language).map((question) => question.text),
    })),
    mustMention: reconfirmationQuestionIds(facts).flatMap((id) =>
      topicWords(id, language).slice(0, 1),
    ),
    unclearQuotes: facts.unclearQuotes.map((quote) => ({
      vendor: localized(quote.vendor, language),
      unclear: quote.fields.map((field) => pack.quoteField[field]),
    })),
    diet: facts.diet.map((diet) => pack.diet[diet]),
    venueLimits: facts.venueLimits.map((limit) => pack.venueLimit[limit]),
  };
}
