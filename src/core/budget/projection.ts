// The projected cost per category, the total, and the gap against the current budget
// (architecture 4.2, spec section 7). One rule, in this order, per category:
//   a lever-adjusted amount, else the booked amount, else the cheapest comparable quote
//   total, else the allocation scaled for the guest count.
// The allocation is the frozen one plus any Move-money delta, and the gap uses the budget as
// it stands now, so a budget cut or a guest rise shows as a gap and never re-splits (D09).

import type { Category } from '@/schemas/readings/vocabulary';

import { fail, fromMoney, succeed, type BudgetResult } from './budget-refusal';
import { categoryRecord } from './category-record';
import { currentAllocationInr, type AllocationDeltas, type FrozenSplit } from './frozen-split';
import { scaledForGuests } from './guest-scaling';
import type { Money } from '../money/money';
import { sum } from '../money/money';

/** What is known about a category beyond its allocation. Later modules fill these in. */
export interface CategoryEvidence {
  /** Set only by a task marked done with an amount; zero is a number the user typed. */
  readonly bookedInr?: number;
  /** The cheapest comparable quote total at the current guests. */
  readonly quote?: { readonly totalInr: number; readonly plusGstRateNotStated: boolean };
  /** The category's projected amount after an applied lever; `exact` for the half contingency. */
  readonly lever?: { readonly projectedInr: number; readonly exact: boolean };
}

export type ProjectionEvidence = Readonly<Partial<Record<Category, CategoryEvidence>>>;

export type ProjectionSource = 'lever' | 'booked' | 'quote' | 'allocation';

export interface ProjectedLine {
  readonly category: Category;
  /** Frozen allocation plus Move-money delta. */
  readonly allocation: Money;
  readonly projected: Money;
  readonly source: ProjectionSource;
  /** Every kind of evidence present, because Move money protects all of them. */
  readonly held: { readonly booked: boolean; readonly quoted: boolean; readonly levered: boolean };
  /** Shown beside a quote whose tax rate the vendor did not state; the amount excludes it. */
  readonly note: 'plus-gst-rate-not-stated' | null;
  /** How far projected exceeds the allocation, or null when it does not. */
  readonly overAllocationBy: Money | null;
}

export interface Projection {
  readonly guestsNow: number;
  readonly budget: Money;
  readonly order: readonly Category[];
  readonly lines: Readonly<Record<Category, ProjectedLine>>;
  readonly projectedTotal: Money;
  /** Projected minus the current budget: positive is over budget, negative is under. */
  readonly gap: Money;
  /** The unspent part of the budget, never negative; Move money uses it first. */
  readonly headroom: Money;
  readonly status: 'within-budget' | 'over-budget';
  readonly overAllocated: readonly Category[];
}

export interface ProjectionInput {
  readonly split: FrozenSplit;
  readonly deltas: AllocationDeltas;
  readonly guestsNow: number;
  readonly budgetNowInr: number;
  readonly evidence: ProjectionEvidence;
}

function usable(inr: number): boolean {
  return Number.isSafeInteger(inr) && inr >= 0;
}

function evidenceUsable(evidence: CategoryEvidence | undefined): boolean {
  if (evidence === undefined) return true;
  return (
    (evidence.bookedInr === undefined || usable(evidence.bookedInr)) &&
    (evidence.quote === undefined || usable(evidence.quote.totalInr)) &&
    (evidence.lever === undefined || usable(evidence.lever.projectedInr))
  );
}

interface Chosen {
  readonly projected: Money;
  readonly source: ProjectionSource;
}

function chooseAmount(
  input: ProjectionInput,
  category: Category,
  allocationInr: number,
): BudgetResult<Chosen> {
  const evidence = input.evidence[category];
  if (evidence?.lever !== undefined) {
    const { projectedInr, exact } = evidence.lever;
    return succeed({
      projected: { inr: projectedInr, provenance: exact ? 'computed' : 'assumption' },
      source: 'lever',
    });
  }
  if (evidence?.bookedInr !== undefined) {
    return succeed({
      projected: { inr: evidence.bookedInr, provenance: 'your-number' },
      source: 'booked',
    });
  }
  if (evidence?.quote !== undefined) {
    return succeed({
      projected: { inr: evidence.quote.totalInr, provenance: 'from-quote' },
      source: 'quote',
    });
  }
  // Contingency never scales, whatever the data says: it is a reserve, not a service.
  const share = category === 'contingency' ? 0 : input.split.lines[category].perGuestSharePercent;
  const scaled = scaledForGuests(allocationInr, share, input.split.guestsAtSplit, input.guestsNow);
  return scaled.ok ? succeed({ projected: scaled.value, source: 'allocation' }) : scaled;
}

function projectLine(input: ProjectionInput, category: Category): BudgetResult<ProjectedLine> {
  const allocationInr = currentAllocationInr(input.split, input.deltas, category);
  const evidence = input.evidence[category];
  if (!usable(allocationInr) || !evidenceUsable(evidence)) return fail('amount-invalid');
  const chosen = chooseAmount(input, category, allocationInr);
  if (!chosen.ok) return chosen;
  const over = chosen.value.projected.inr - allocationInr;
  return succeed({
    category,
    allocation: { inr: allocationInr, provenance: 'your-split' },
    projected: chosen.value.projected,
    source: chosen.value.source,
    held: {
      booked: evidence?.bookedInr !== undefined,
      quoted: evidence?.quote !== undefined,
      levered: evidence?.lever !== undefined,
    },
    note: evidence?.quote?.plusGstRateNotStated === true ? 'plus-gst-rate-not-stated' : null,
    overAllocationBy: over > 0 ? { inr: over, provenance: 'computed' } : null,
  });
}

export function projectSpend(input: ProjectionInput): BudgetResult<Projection> {
  if (!Number.isSafeInteger(input.guestsNow) || input.guestsNow < 1) {
    return fail('guests-out-of-range');
  }
  if (!Number.isSafeInteger(input.budgetNowInr) || input.budgetNowInr < 1) {
    return fail('budget-out-of-range');
  }
  const built = new Map<Category, ProjectedLine>();
  for (const category of input.split.order) {
    const line = projectLine(input, category);
    if (!line.ok) return line;
    built.set(category, line.value);
  }
  const lines = categoryRecord((category) => built.get(category));
  if (lines === null) return fail('profile-incomplete');
  const total = sum(input.split.order.map((category) => lines[category].projected));
  if (!total.ok) return fromMoney(total);
  const gapInr = total.value.inr - input.budgetNowInr;
  return succeed({
    guestsNow: input.guestsNow,
    budget: { inr: input.budgetNowInr, provenance: 'your-number' },
    order: input.split.order,
    lines,
    projectedTotal: total.value,
    gap: { inr: gapInr, provenance: 'computed' },
    headroom: { inr: Math.max(0, -gapInr), provenance: 'computed' },
    status: gapInr > 0 ? 'over-budget' : 'within-budget',
    overAllocated: input.split.order.filter(
      (category) => lines[category].overAllocationBy !== null,
    ),
  });
}
