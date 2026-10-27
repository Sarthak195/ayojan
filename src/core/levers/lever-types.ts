// The shapes shared by the lever modules (architecture 4.5). A lever is never selected for the
// family: these types describe what each lever would do and whether it may be chosen, and a
// selection is always an explicit list of ids that came from the user.

import type { LeversFile } from '@/schemas/data/levers';
import type { Category, MustHave } from '@/schemas/readings/vocabulary';

import type { Money } from '../money/money';

export type LeverRows = LeversFile['levers'];
export type LeverRow = LeverRows[number];

/** Evaluation order: disabled, then refused, then not applicable, else offered. */
export type LeverStatus = 'disabled' | 'refused' | 'not-applicable' | 'offered';

export type LeverReason =
  | { readonly kind: 'must-have'; readonly mustHave: MustHave }
  | { readonly kind: 'invest-more'; readonly category: Category }
  | { readonly kind: 'booked'; readonly category: Category };

export type LeverProvenance = 'exact' | 'assumption';

export interface LeverOption {
  readonly id: string;
  readonly effect: LeverRow['effect'];
  readonly label: { readonly en: string; readonly hi: string };
  readonly consequence: { readonly en: string; readonly hi: string };
  /** The data row's one-line reasoning, for the "Why this number?" disclosure. */
  readonly basis: string;
  /** The same reasoning in Hindi, or null where none is written yet (the page shows English). */
  readonly basisHi: string | null;
  readonly category: Category | null;
  /** The percent of the category's projected amount, for a percent lever. */
  readonly percent: number | null;
  readonly status: LeverStatus;
  readonly reason: LeverReason | null;
  readonly provenance: LeverProvenance;
  /**
   * What the lever saves on this plan, shown for refused levers too. For "raise the budget"
   * it is the amount that closes the gap. Provenance is computed (exact) or assumption.
   */
  readonly saving: Money;
  /** What half the contingency leaves in the reserve; null for every other lever. */
  readonly bufferLeft: Money | null;
  /** The task that switches to its faster alternative when this lever is chosen. */
  readonly fasterAlternativeFor: string | null;
  /** A refused lever may be chosen with "Show anyway"; one on a booked category may not. */
  readonly showAnywayAllowed: boolean;
}

export function categoryOf(row: LeverRow): Category | null {
  return row.effect === 'raiseBudget' ? null : row.category;
}

export function fasterAlternativeOf(row: LeverRow): string | null {
  return row.effect === 'percentOfCategory' ? row.fasterAlternativeFor : null;
}
