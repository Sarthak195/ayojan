// The facts a family update or vendor message may state (D07, D32), filled from the plan view
// so the messages module never folds a plan itself. Every number here is one the pages show.

import { LeverId, QuestionId } from '@/schemas/generated/ids';

import type {
  AppliedLever,
  AtRiskTask,
  Headline,
  MessageFactsInput,
  UnclearQuote,
  UnclearQuoteField,
  VendorFact,
} from '../messages/fact-types';
import { quoteLabel } from '../quotes/quote-wording';
import type { PlanData } from './plan-data';
import type { VendorContact } from './plan-vendors';
import type { PlanVersion } from './plan-version';

const UNCLEAR_FIELDS: readonly UnclearQuoteField[] = [
  'taxRate',
  'minimumGuests',
  'guestsCovered',
  'rateAboveMinimum',
  'days',
];

export function headlineOf(version: PlanVersion): Headline {
  return {
    budgetInr: version.headline.budget.inr,
    guests: version.headline.guests,
    eventDate: version.headline.eventDate,
    projectedInr: version.headline.projected.inr,
  };
}

function appliedLevers(version: PlanVersion, data: PlanData): AppliedLever[] {
  const levers: AppliedLever[] = [];
  for (const line of version.money.applied) {
    const id = LeverId.safeParse(line.id);
    const row = data.levers.levers.find((lever) => lever.id === line.id);
    if (!id.success || row === undefined) continue;
    levers.push({ id: id.data, label: { en: row.en, hi: row.hi }, effectInr: line.effect.inr });
  }
  return levers;
}

function atRiskTasks(version: PlanVersion): AtRiskTask[] {
  const tasks: AtRiskTask[] = [];
  for (const task of version.schedule.tasks) {
    if (task.status !== 'late' && task.status !== 'atRisk') continue;
    tasks.push({
      taskId: task.id,
      name: { en: task.en, hi: task.hi },
      status: task.status,
      dueBy: task.latestFinish,
    });
  }
  return tasks;
}

function vendorFacts(contacts: readonly VendorContact[]): VendorFact[] {
  return contacts.map((contact) => ({
    label: contact.label,
    category: contact.vendor.category,
    questionIds: contact.questions.flatMap((question) => {
      const id = QuestionId.safeParse(question.id);
      return id.success ? [id.data] : [];
    }),
    bookedCapacity: contact.bookedCapacity,
  }));
}

function unclearQuotes(version: PlanVersion): UnclearQuote[] {
  const found: UnclearQuote[] = [];
  for (const comparison of version.comparisons) {
    for (const row of comparison.rows) {
      if (row.key !== 'comparableTotal') continue;
      for (const total of row.cells) {
        const quote = version.quotes.find((candidate) => candidate.id === total.quoteId);
        const fields = UNCLEAR_FIELDS.filter((field) => total.gaps.includes(field));
        if (quote === undefined || fields.length === 0) continue;
        found.push({
          vendor: { en: quoteLabel(quote, 'en'), hi: quoteLabel(quote, 'hi') },
          fields,
        });
      }
    }
  }
  return found;
}

export function messageFactsInput(
  current: PlanVersion,
  before: PlanVersion | null,
  contacts: readonly VendorContact[],
  data: PlanData,
): MessageFactsInput {
  return {
    occasion: current.brief.occasion,
    now: headlineOf(current),
    before: before === null ? null : headlineOf(before),
    daysToEvent: current.schedule.daysToEvent,
    levers: appliedLevers(current, data),
    atRisk: atRiskTasks(current),
    vendors: vendorFacts(contacts),
    unclearQuotes: unclearQuotes(current),
    diet: current.brief.diet,
    venueLimits: current.brief.venueLimits,
  };
}
