// Every number a message about these facts may contain. Differences are included because a
// family update naturally says "30 fewer guests" or "Rs 1,00,000 more", and each of them is
// computed here from the facts, never written by a model.

import { daysBetween, partsOf } from '@/core/calendar/day-number';
import type { IsoDate } from '@/core/calendar/day-number';

import type { Headline, MessageFacts } from './fact-types';

function addDateParts(numbers: Set<number>, date: IsoDate): void {
  const { year, month, day } = partsOf(date);
  numbers.add(year);
  numbers.add(month);
  numbers.add(day);
}

function addHeadline(numbers: Set<number>, headline: Headline): void {
  numbers.add(headline.budgetInr);
  numbers.add(headline.guests);
  numbers.add(headline.projectedInr);
  addDateParts(numbers, headline.eventDate);
}

function addChange(numbers: Set<number>, before: Headline, now: Headline): void {
  addHeadline(numbers, before);
  numbers.add(Math.abs(now.budgetInr - before.budgetInr));
  numbers.add(Math.abs(now.guests - before.guests));
  numbers.add(Math.abs(now.projectedInr - before.projectedInr));
  numbers.add(Math.abs(daysBetween(before.eventDate, now.eventDate)));
}

/** The set of whole numbers (rupees, counts, days, date parts) the facts support. */
export function factNumbers(facts: MessageFacts): ReadonlySet<number> {
  const numbers = new Set<number>();
  addHeadline(numbers, facts.now);
  if (facts.before !== null) addChange(numbers, facts.before, facts.now);
  numbers.add(Math.abs(facts.gapInr));
  numbers.add(Math.abs(facts.daysToEvent));
  numbers.add(facts.levers.length);
  for (const lever of facts.levers) numbers.add(lever.effectInr);
  numbers.add(facts.atRisk.length);
  for (const task of facts.atRisk) addDateParts(numbers, task.dueBy);
  numbers.add(facts.vendors.length);
  for (const vendor of facts.vendors) {
    if (vendor.bookedCapacity !== null) numbers.add(vendor.bookedCapacity);
  }
  numbers.add(facts.unclearQuotes.length);
  return numbers;
}
