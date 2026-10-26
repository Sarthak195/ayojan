// Applying chosen levers to a copy of the plan (architecture 4.5, integration contract). The
// savings are never summed: each lever reduces its category's projected amount, then the
// whole plan is projected again, so overlapping choices cannot double-count. Applying is
// deliberately forgiving about eligibility, because a lever chosen last week stays chosen
// after a later booking or priority change; the strict checks live in selection.ts.

import type { Category } from '@/schemas/readings/vocabulary';

import { succeed, type BudgetResult } from '../budget/budget-refusal';
import type {
  CategoryEvidence,
  Projection,
  ProjectionEvidence,
  ProjectionInput,
} from '../budget/projection';
import { projectSpend } from '../budget/projection';
import type { Money } from '../money/money';
import { savingInr } from './lever-saving';
import type { LeverRow, LeverRows } from './lever-types';
import { categoryOf, fasterAlternativeOf } from './lever-types';

export interface AppliedLever {
  readonly id: string;
  readonly saving: Money;
}

export interface SkippedLever {
  readonly id: string;
  /** `booked`: the category has a real booked amount, which no assumption may overwrite. */
  readonly reason: 'unknown' | 'booked';
}

export interface LeverApplication {
  /** The plan with no lever applied, the baseline every saving is measured against. */
  readonly base: Projection;
  /** The plan after the levers: the figures the pages show. */
  readonly projection: Projection;
  readonly applied: readonly AppliedLever[];
  readonly skipped: readonly SkippedLever[];
  /** The budget after any raise-the-budget lever. */
  readonly budgetNowInr: number;
  readonly raisedByInr: number;
  /** Tasks that switch to their faster alternative, for the scheduler. */
  readonly fasterTaskIds: readonly string[];
  /** How much the gap shrank: savings plus any budget raise. */
  readonly closedInr: number;
}

export interface LeverApplicationInput {
  /** The projection input with no lever evidence; any lever evidence passed is ignored. */
  readonly base: ProjectionInput;
  readonly levers: LeverRows;
  readonly selected: readonly string[];
}

/** Evidence without levers: the baseline must not already contain what is being applied. */
export function withoutLevers(evidence: ProjectionEvidence): ProjectionEvidence {
  const kept: Partial<Record<Category, CategoryEvidence>> = {};
  for (const [category, entry] of Object.entries(evidence) as [Category, CategoryEvidence][]) {
    kept[category] = {
      ...(entry.bookedInr === undefined ? {} : { bookedInr: entry.bookedInr }),
      ...(entry.quote === undefined ? {} : { quote: entry.quote }),
    };
  }
  return kept;
}

interface Running {
  readonly amountInr: number;
  readonly exact: boolean;
}

export function applyLevers(input: LeverApplicationInput): BudgetResult<LeverApplication> {
  const plain: ProjectionInput = { ...input.base, evidence: withoutLevers(input.base.evidence) };
  const base = projectSpend(plain);
  if (!base.ok) return base;
  const wanted = new Set(input.selected);
  const running = new Map<Category, Running>();
  const applied: AppliedLever[] = [];
  const skipped: SkippedLever[] = [];
  const faster: string[] = [];
  let raiseRow: LeverRow | null = null;
  for (const row of input.levers) {
    if (!wanted.has(row.id)) continue;
    const category = categoryOf(row);
    if (category === null) {
      raiseRow = row;
      continue;
    }
    if (base.value.lines[category].held.booked) {
      skipped.push({ id: row.id, reason: 'booked' });
      continue;
    }
    const before = running.get(category) ?? {
      amountInr: base.value.lines[category].projected.inr,
      exact: true,
    };
    const saving = savingInr(row, before.amountInr, 0);
    if (!saving.ok) return saving;
    running.set(category, {
      amountInr: before.amountInr - saving.value,
      exact: before.exact && row.provenance === 'exact',
    });
    applied.push({
      id: row.id,
      saving: {
        inr: saving.value,
        provenance: row.provenance === 'exact' ? 'computed' : 'assumption',
      },
    });
    const task = fasterAlternativeOf(row);
    if (task !== null) faster.push(task);
  }
  for (const id of wanted) {
    if (!input.levers.some((row) => row.id === id)) skipped.push({ id, reason: 'unknown' });
  }
  const evidence: Partial<Record<Category, CategoryEvidence>> = { ...plain.evidence };
  for (const [category, state] of running) {
    evidence[category] = {
      ...plain.evidence[category],
      lever: { projectedInr: state.amountInr, exact: state.exact },
    };
  }
  const levered = projectSpend({ ...plain, evidence });
  if (!levered.ok) return levered;
  // Raising the budget covers whatever the other chosen levers leave over, so a family that
  // also trims decor is not asked to raise the budget by the whole original gap.
  const raise = raiseRow === null ? 0 : Math.max(0, levered.value.gap.inr);
  if (raiseRow !== null) {
    applied.push({ id: raiseRow.id, saving: { inr: raise, provenance: 'computed' } });
  }
  const budgetNowInr = plain.budgetNowInr + raise;
  const final = raise === 0 ? levered : projectSpend({ ...plain, evidence, budgetNowInr });
  if (!final.ok) return final;
  return succeed({
    base: base.value,
    projection: final.value,
    applied,
    skipped,
    budgetNowInr,
    raisedByInr: raise,
    fasterTaskIds: faster,
    closedInr: base.value.gap.inr - final.value.gap.inr,
  });
}
