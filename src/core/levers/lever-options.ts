// The lever list for the current plan (architecture 4.5, FR-31). Every lever in the data is
// reported with what it would save, even when it may not be chosen, so the family sees the
// cost of the choice they are not being offered. Nothing here selects anything.

import type { Category, MustHave, Priority } from '@/schemas/readings/vocabulary';

import { succeed, type BudgetResult } from '../budget/budget-refusal';
import type { Projection } from '../budget/projection';
import { savingInr } from './lever-saving';
import type { LeverOption, LeverReason, LeverRow, LeverRows, LeverStatus } from './lever-types';
import { categoryOf, fasterAlternativeOf } from './lever-types';

export interface LeverContext {
  readonly levers: LeverRows;
  readonly priorities: Readonly<Record<Category, Priority>>;
  readonly mustHaves: readonly MustHave[];
}

interface Verdict {
  readonly status: LeverStatus;
  readonly reason: LeverReason | null;
  readonly alsoBooked: boolean;
}

function verdict(row: LeverRow, context: LeverContext, projection: Projection): Verdict {
  const category = categoryOf(row);
  const conflict = row.mustHaveConflicts.find((item) => context.mustHaves.includes(item));
  if (conflict !== undefined) {
    return {
      status: 'disabled',
      reason: { kind: 'must-have', mustHave: conflict },
      alsoBooked: false,
    };
  }
  const booked = category !== null && projection.lines[category].held.booked;
  if (category !== null && context.priorities[category] === 'more') {
    return {
      status: 'refused',
      reason: { kind: 'invest-more', category },
      alsoBooked: booked,
    };
  }
  if (category !== null && booked) {
    return { status: 'not-applicable', reason: { kind: 'booked', category }, alsoBooked: true };
  }
  return { status: 'offered', reason: null, alsoBooked: false };
}

/**
 * Levers for a plan that is over budget, measured on `projection` as it stands without any
 * lever applied. Within budget there is nothing to trade off, so the list is empty.
 */
export function leverOptions(
  context: LeverContext,
  projection: Projection,
): BudgetResult<readonly LeverOption[]> {
  if (projection.status === 'within-budget') return succeed([]);
  const options: LeverOption[] = [];
  for (const row of context.levers) {
    const category = categoryOf(row);
    const current = category === null ? 0 : projection.lines[category].projected.inr;
    const saving = savingInr(row, current, projection.gap.inr);
    if (!saving.ok) return saving;
    const { status, reason, alsoBooked } = verdict(row, context, projection);
    options.push({
      id: row.id,
      effect: row.effect,
      label: { en: row.en, hi: row.hi },
      consequence: row.consequence,
      basis: row.basis,
      basisHi: row.basisHi ?? null,
      category,
      percent: row.effect === 'percentOfCategory' ? row.percent : null,
      status,
      reason,
      provenance: row.provenance,
      saving: {
        inr: saving.value,
        provenance: row.provenance === 'exact' ? 'computed' : 'assumption',
      },
      bufferLeft:
        row.effect === 'halfContingency'
          ? { inr: current - saving.value, provenance: 'computed' }
          : null,
      fasterAlternativeFor: fasterAlternativeOf(row),
      showAnywayAllowed: status === 'refused' && !alsoBooked,
    });
  }
  return succeed(options);
}
