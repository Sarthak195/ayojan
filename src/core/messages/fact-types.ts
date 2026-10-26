// The shapes of message facts, apart from the code that builds them, so templates and the
// draft check can import the types without importing each other. The plan view fills
// MessageFactsInput from its own results; this module imports no plan code (that code is
// built later), so the contract is a plain object that is also safe to hash for the cache.

import type { IsoDate } from '@/core/calendar/day-number';
import type { QuestionId, LeverId } from '@/schemas/generated/ids';
import type { Category, Diet, Occasion, VenueLimit } from '@/schemas/readings/vocabulary';

/** Text in both languages, taken from the data files or the dictionary by the caller. */
export interface LocalText {
  readonly en: string;
  readonly hi: string;
}

/** The numbers a family update leads with, for one version of the plan. */
export interface Headline {
  readonly budgetInr: number;
  readonly guests: number;
  readonly eventDate: IsoDate;
  /** Projected total spend after levers. */
  readonly projectedInr: number;
}

export interface AppliedLever {
  readonly id: LeverId;
  readonly label: LocalText;
  /** Rupees saved, or for raise-budget the rupees added. */
  readonly effectInr: number;
}

export interface AtRiskTask {
  readonly taskId: string;
  readonly name: LocalText;
  readonly status: 'late' | 'atRisk';
  readonly dueBy: IsoDate;
}

export interface VendorFact {
  /** "Caterer A": vendors have no names in the app. */
  readonly label: LocalText;
  readonly category: Category;
  /** Questions the plan wants this vendor to answer, in the order to ask them. */
  readonly questionIds: readonly QuestionId[];
  /** The capacity this vendor was booked for, if the family entered one. */
  readonly bookedCapacity: number | null;
}

export type UnclearQuoteField =
  'taxRate' | 'minimumGuests' | 'guestsCovered' | 'rateAboveMinimum' | 'days';

export interface UnclearQuote {
  readonly vendor: LocalText;
  readonly fields: readonly UnclearQuoteField[];
}

export interface MessageFactsInput {
  readonly occasion: Occasion;
  /** The latest revision. */
  readonly now: Headline;
  /** The version before the latest change (D32); null while the plan has no revision. */
  readonly before: Headline | null;
  /** Days from today to the event; zero or negative once it is today or past. */
  readonly daysToEvent: number;
  readonly levers: readonly AppliedLever[];
  readonly atRisk: readonly AtRiskTask[];
  readonly vendors: readonly VendorFact[];
  readonly unclearQuotes: readonly UnclearQuote[];
  readonly diet: readonly Diet[];
  readonly venueLimits: readonly VenueLimit[];
}

/** The input after cleaning, plus what code derived from it. */
export interface MessageFacts extends MessageFactsInput {
  /** Projected minus budget: positive means over budget. */
  readonly gapInr: number;
  /** True when there is a version to compare with; false gives a plan summary. */
  readonly hasRevision: boolean;
}
