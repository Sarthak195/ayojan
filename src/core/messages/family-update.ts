// The family update as a list of short lines (one WhatsApp line each), written from the facts
// alone. Lines for things that did not happen are left out rather than saying "none".

import type { Language } from '@/core/rupees/format';

import type { Headline, MessageFacts } from './fact-types';
import { dateText, localized, moneyText, packFor } from './render-values';

function changeLines(facts: MessageFacts, before: Headline, language: Language): string[] {
  const { sentences } = packFor(language);
  const { now } = facts;
  const lines: string[] = [];
  if (now.budgetInr !== before.budgetInr) {
    lines.push(
      sentences.budgetChanged(
        moneyText(now.budgetInr, language),
        moneyText(before.budgetInr, language),
      ),
    );
  }
  if (now.guests !== before.guests) lines.push(sentences.guestsChanged(now.guests, before.guests));
  if (now.eventDate !== before.eventDate) {
    lines.push(
      sentences.dateChanged(
        dateText(now.eventDate, language),
        dateText(before.eventDate, language),
      ),
    );
  }
  return lines.length > 0 ? lines : [sentences.nothingChanged];
}

function budgetLines(facts: MessageFacts, language: Language): string[] {
  const { sentences } = packFor(language);
  const spend = sentences.spend(
    moneyText(facts.now.projectedInr, language),
    moneyText(facts.now.budgetInr, language),
  );
  if (!facts.now.priced) return [spend, sentences.notPriced];
  if (facts.gapInr > 0) return [spend, sentences.over(moneyText(facts.gapInr, language))];
  if (facts.gapInr === 0) return [spend, sentences.onBudget];
  return [spend, sentences.under(moneyText(-facts.gapInr, language))];
}

function leverLine(facts: MessageFacts, language: Language): string[] {
  if (facts.levers.length === 0) return [];
  const { sentences } = packFor(language);
  const items = facts.levers.map((lever) => {
    const label = localized(lever.label, language);
    const amount = moneyText(lever.effectInr, language);
    return lever.id === 'raise-budget'
      ? sentences.leverAdds(label, amount)
      : sentences.leverSaves(label, amount);
  });
  return [sentences.levers(items.join(', '))];
}

function attentionLine(facts: MessageFacts, language: Language): string[] {
  if (facts.atRisk.length === 0) return [];
  const pack = packFor(language);
  const items = facts.atRisk.map((task) => {
    const name = localized(task.name, language);
    const due = dateText(task.dueBy, language);
    return task.status === 'late'
      ? pack.sentences.lateItem(name, due)
      : pack.sentences.attentionItem(name, pack.status.atRisk, due);
  });
  return [pack.sentences.attention(items.join(', '))];
}

function vendorLines(facts: MessageFacts, language: Language): string[] {
  const { sentences } = packFor(language);
  const lines: string[] = [];
  if (facts.vendors.length > 0) {
    const names = facts.vendors.map((vendor) => localized(vendor.label, language));
    lines.push(sentences.vendors(facts.vendors.length, names.join(', ')));
  }
  if (facts.unclearQuotes.length > 0) {
    const pack = packFor(language);
    const items = facts.unclearQuotes.map((quote) =>
      sentences.unclearItem(
        localized(quote.vendor, language),
        quote.fields.map((field) => pack.quoteField[field]).join(', '),
      ),
    );
    lines.push(sentences.unclear(items.join('; ')));
  }
  return lines;
}

function keptInMindLine(facts: MessageFacts, language: Language): string[] {
  const pack = packFor(language);
  const items = [
    ...facts.diet.map((diet) => pack.diet[diet]),
    ...facts.venueLimits.map((limit) => pack.venueLimit[limit]),
  ];
  return items.length === 0 ? [] : [pack.sentences.keptInMind(items.join(', '))];
}

export function familyUpdateLines(facts: MessageFacts, language: Language): string[] {
  const pack = packFor(language);
  const { sentences } = pack;
  const occasion = pack.occasion[facts.occasion];
  return [
    sentences.title(occasion, dateText(facts.now.eventDate, language)),
    ...(facts.daysToEvent > 0 ? [sentences.daysToGo(facts.daysToEvent)] : []),
    ...(facts.before === null ? [sentences.standing] : changeLines(facts, facts.before, language)),
    ...budgetLines(facts, language),
    ...leverLine(facts, language),
    ...attentionLine(facts, language),
    ...vendorLines(facts, language),
    ...keptInMindLine(facts, language),
    sentences.signOff,
  ];
}
