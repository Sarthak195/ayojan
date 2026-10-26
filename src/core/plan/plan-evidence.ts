// What the plan knows about each category beyond its allocation: bookings from tasks marked done
// with an amount (D10) and the cheapest comparable quote at the current guests. Built in one
// place so a Move money step in the middle of the ledger and the final view read evidence the
// same way.

import type { QuoteRecord } from '@/schemas/plan/quote-record';
import type { Category } from '@/schemas/readings/vocabulary';

import type { CategoryEvidence, ProjectionEvidence } from '../budget/projection';
import type { PlanRequirements } from '../quotes/quote-types';
import { cheapestByCategory, type CheapestQuote } from '../quotes/ranking';
import { latestDone } from '../timeline/schedule';
import type { DoneRecord } from '../timeline/schedule-types';
import { bookingsFrom, type Booking } from '../timeline/task-progress';
import type { ResolvedTask } from '../timeline/task-selection';
import { planOk, quotesFail, type PlanResult } from './plan-refusal';

export interface EvidenceFacts {
  readonly quotes: readonly QuoteRecord[];
  readonly done: readonly DoneRecord[];
  readonly guests: number;
}

export interface EvidenceContext {
  /** The active tasks; only their `books` field matters here, so faster alternatives are moot. */
  readonly tasks: readonly ResolvedTask[];
  readonly requirements: PlanRequirements;
}

export interface VenueCapacity {
  readonly capacity: number | null;
  readonly source: 'booking' | 'brief' | null;
}

export interface PlanEvidence {
  readonly evidence: ProjectionEvidence;
  readonly bookings: readonly Booking[];
  readonly cheapest: Readonly<Partial<Record<Category, CheapestQuote>>>;
}

export function evidenceFor(
  facts: EvidenceFacts,
  context: EvidenceContext,
): PlanResult<PlanEvidence> {
  const cheapest = cheapestByCategory(facts.quotes, facts.guests, context.requirements);
  if (!cheapest.ok) return quotesFail(cheapest.reason);
  const bookings = bookingsFrom(facts.done, context.tasks);
  const evidence: Partial<Record<Category, CategoryEvidence>> = {};
  for (const [category, quote] of Object.entries(cheapest.value) as [Category, CheapestQuote][]) {
    evidence[category] = {
      quote: { totalInr: quote.totalInr, plusGstRateNotStated: quote.plusGstRateNotStated },
    };
  }
  // A booked amount of 0 is still the family's number, so presence, not truthiness, decides.
  for (const booking of bookings) {
    evidence[booking.category] = { ...evidence[booking.category], bookedInr: booking.amountInr };
  }
  return planOk({ evidence, bookings, cheapest: cheapest.value });
}

/**
 * The venue capacity the plan checks guests against. A venue task marked done with a capacity
 * overrides the brief's figure (D10), with or without an amount, because the family told us
 * what the hall takes either way; the latest mark wins, as it does for the booking.
 */
export function venueCapacityOf(
  done: readonly DoneRecord[],
  tasks: readonly ResolvedTask[],
  briefCapacity: number | null,
): VenueCapacity {
  for (const task of tasks) {
    const record = task.books === 'venue' ? latestDone(done).get(task.id) : undefined;
    if (record !== undefined && record.capacity !== null) {
      return { capacity: record.capacity, source: 'booking' };
    }
  }
  return briefCapacity === null
    ? { capacity: null, source: null }
    : { capacity: briefCapacity, source: 'brief' };
}
