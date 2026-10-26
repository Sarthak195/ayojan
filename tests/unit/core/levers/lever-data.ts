import { join } from 'node:path';

import type { QuoteRecord } from '@/schemas/plan/quote-record';
import type { Category, MustHave, Priority } from '@/schemas/readings/vocabulary';
import { createKnowledgeRepository, readFromDirectory } from '@/server/knowledge/repository';

import type { CategoryEvidence, ProjectionInput } from '@/core/budget/projection';
import type { LeverContext } from '@/core/levers/lever-options';
import { cheapestByCategory } from '@/core/quotes/ranking';
import { requirementsFrom } from '@/core/quotes/quote-types';

import { DEMO_PRIORITIES, splitFor } from '../budget/draft-data';
import { CATERER_A, CATERER_B, quote } from '../quotes/quote-data';

const documents = createKnowledgeRepository(readFromDirectory(join(process.cwd(), 'data'))).all();
export const leverRows = documents.levers.levers;

export function context(
  mustHaves: readonly MustHave[] = [],
  priorities: Record<Category, Priority> = DEMO_PRIORITIES,
): LeverContext {
  return { levers: leverRows, priorities, mustHaves };
}

export function quoteEvidence(
  quotes: readonly QuoteRecord[],
  guests: number,
  mustHaves: readonly MustHave[] = [],
): Partial<Record<Category, CategoryEvidence>> {
  const found = cheapestByCategory(quotes, guests, requirementsFrom(mustHaves));
  if (!found.ok) throw new Error(found.reason);
  const evidence: Partial<Record<Category, CategoryEvidence>> = {};
  for (const [category, cheapest] of Object.entries(found.value) as [
    Category,
    NonNullable<(typeof found.value)[Category]>,
  ][]) {
    evidence[category] = {
      quote: {
        totalInr: cheapest.totalInr,
        plusGstRateNotStated: cheapest.plusGstRateNotStated,
      },
    };
  }
  return evidence;
}

// Spec 5.3, pinned by hand: a fresh 8 lakh, 200 guest plan with a venue quote of Rs 2,50,000,
// a caterer at Rs 1,800 a plate (minimum 200, GST included) and a photographer at Rs 1,20,000.
// Projected Rs 9,57,000, over by Rs 1,57,000.
export const OVER_BUDGET_QUOTES: readonly QuoteRecord[] = [
  quote({ id: 'A', category: 'venue', basis: 'lumpSum', rateInr: 250_000, guestsCovered: 200 }),
  quote({ id: 'B', rateInr: 1_800 }),
  quote({ id: 'C', category: 'photo', basis: 'lumpSum', rateInr: 120_000, guestsCovered: 200 }),
];

export function overBudget(): ProjectionInput {
  return {
    split: splitFor(),
    deltas: {},
    guestsNow: 200,
    budgetNowInr: 800_000,
    evidence: quoteEvidence(OVER_BUDGET_QUOTES, 200),
  };
}

// Spec 5.2 after the change, pinned by hand: 250 guests, a budget of Rs 7,50,000, the venue
// booked at Rs 1,80,000, and the two caterer quotes. Projected Rs 7,98,900, over by Rs 48,900.
export function afterTheChange(): ProjectionInput {
  return {
    split: splitFor(),
    deltas: {},
    guestsNow: 250,
    budgetNowInr: 750_000,
    evidence: {
      ...quoteEvidence([CATERER_A, CATERER_B], 250),
      venue: { bookedInr: 180_000 },
    },
  };
}

export function leverRow(id: string): (typeof leverRows)[number] {
  const found = leverRows.find((row) => row.id === id);
  if (found === undefined) throw new Error(`No lever ${id} in the data`);
  return found;
}
