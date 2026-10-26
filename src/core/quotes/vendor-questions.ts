// The questions to ask a vendor (architecture 4.7, FR-20, decision D14). Which questions
// apply is a lookup over data/vendor-questions.yaml: each row says what raises it, and this
// module only checks that condition against the quote and the plan. Order is the data's order,
// so the same plan always gives the same list, and both languages are rendered together.

import type { QuestionRow, VendorQuestionsFile } from '@/schemas/data/vendor-questions';
import type { QuoteRecord } from '@/schemas/plan/quote-record';
import type {
  Category,
  Diet,
  GuestNeed,
  MustHave,
  VenueLimit,
} from '@/schemas/readings/vocabulary';

import { liveCounterMissing } from './extras';
import type { ComparableTotal, PlanRequirements, QuoteGap } from './quote-types';
import { requirementsFrom } from './quote-types';

export type Reconfirmation = 'date' | 'guests' | 'capacity';

export interface QuestionPlan {
  readonly mustHaves: readonly MustHave[];
  readonly needs: readonly GuestNeed[];
  readonly diet: readonly Diet[];
  readonly venueLimits: readonly VenueLimit[];
  /** What changed since this vendor quoted or was booked; the plan layer decides. */
  readonly reconfirm: readonly Reconfirmation[];
  readonly values: {
    readonly guests: number;
    readonly capacity: number | null;
    /** Already formatted for the reader, e.g. "12 Feb"; this module does not format dates. */
    readonly date: string | null;
  };
}

/** A vendor the family is dealing with: its category, and its quote if it has one. */
export interface QuestionSubject {
  readonly category: Category;
  readonly quote: QuoteRecord | null;
  readonly total: ComparableTotal | null;
}

export interface VendorQuestion {
  readonly id: string;
  readonly en: string;
  readonly hi: string;
  readonly raisedBy: QuestionRow['raisedBy'];
}

function raised(
  row: QuestionRow,
  subject: QuestionSubject,
  plan: QuestionPlan,
  requirements: PlanRequirements,
): boolean {
  const cause = row.raisedBy;
  const gaps: readonly QuoteGap[] = subject.total?.gaps ?? [];
  switch (cause.when) {
    case 'unclearField':
      return gaps.includes(cause.field);
    case 'capExceeded':
      return subject.total?.status === 'cap-exceeded';
    case 'reconfirmation':
      return plan.reconfirm.includes(cause.subject);
    case 'mustHave':
      // A must-have the quote already prices is answered; one it omits is the question.
      return (
        plan.mustHaves.includes(cause.mustHave) &&
        (cause.mustHave !== 'liveCounter' ||
          subject.quote === null ||
          liveCounterMissing(subject.quote, requirements))
      );
    case 'need':
      return plan.needs.includes(cause.need);
    case 'diet':
      return plan.diet.includes(cause.diet);
    case 'venueLimit':
      return plan.venueLimits.includes(cause.venueLimit);
  }
}

function fill(template: string, plan: QuestionPlan): string | null {
  const values: Record<string, string | null> = {
    guests: String(plan.values.guests),
    capacity: plan.values.capacity === null ? null : String(plan.values.capacity),
    date: plan.values.date,
  };
  const names = [...template.matchAll(/{([^}]*)}/g)].map((match) => match[1] ?? '');
  // One placeholder the plan cannot fill makes the whole question unsendable.
  if (names.some((name) => values[name] === null || values[name] === undefined)) return null;
  return template.replace(/{([^}]*)}/g, (_whole: string, name: string) => values[name] ?? '');
}

export function vendorQuestions(
  questions: VendorQuestionsFile['questions'],
  subject: QuestionSubject,
  plan: QuestionPlan,
): readonly VendorQuestion[] {
  const requirements = requirementsFrom(plan.mustHaves);
  const asked: VendorQuestion[] = [];
  for (const row of questions) {
    if (row.categories.length > 0 && !row.categories.includes(subject.category)) continue;
    if (!raised(row, subject, plan, requirements)) continue;
    // A question whose number the plan cannot supply is skipped rather than sent half-written.
    const en = fill(row.en, plan);
    const hi = fill(row.hi, plan);
    if (en !== null && hi !== null) asked.push({ id: row.id, en, hi, raisedBy: row.raisedBy });
  }
  return asked;
}
