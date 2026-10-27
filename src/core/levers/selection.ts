// Choosing levers (architecture 4.5, FR-32). A selection is checked against the plan as it
// stands, then applied to a copy and projected again. The result is a preview: nothing is
// stored here, the route turns an applied selection into one op, and the client's own idea of
// the total is never read.

import type { BudgetRefusal } from '../budget/budget-refusal';
import { projectSpend, type ProjectionInput } from '../budget/projection';
import type { LeverApplication } from './lever-application';
import { applyLevers, withoutLevers } from './lever-application';
import type { LeverContext } from './lever-options';
import { leverOptions } from './lever-options';
import type { LeverOption, LeverReason } from './lever-types';
import type { RunningLine } from './running-line';
import { runningLine } from './running-line';

export type SelectionRefusal =
  | { readonly kind: 'unknown-lever'; readonly id: string }
  /** The plan is within budget, so no lever is on offer. */
  | { readonly kind: 'not-offered'; readonly id: string }
  | { readonly kind: 'lever-disabled'; readonly id: string; readonly reason: LeverReason | null }
  /** Refused for an invest-more category and not ticked "Show anyway", or not allowed at all. */
  | { readonly kind: 'lever-refused'; readonly id: string; readonly reason: LeverReason | null }
  | {
      readonly kind: 'lever-not-applicable';
      readonly id: string;
      readonly reason: LeverReason | null;
    }
  | { readonly kind: 'budget'; readonly reason: BudgetRefusal };

export interface SelectionInput extends LeverContext {
  /** The projection input with no lever evidence; any lever evidence passed is ignored. */
  readonly base: ProjectionInput;
  readonly selected: readonly string[];
  /** The levers whose "Show anyway" box was ticked. */
  readonly showAnyway: readonly string[];
}

export interface SelectionPreview {
  /** False for an empty selection: there is nothing to write as an op. */
  readonly canApply: boolean;
  /** The chosen lever ids in data order, ready for the op. */
  readonly selected: readonly string[];
  readonly application: LeverApplication;
  readonly line: RunningLine;
  /**
   * True when every lever on offer (other than raising the budget) is chosen and the plan is
   * still over: the remaining choices are a refused lever, a higher budget or fewer guests.
   */
  readonly exhausted: boolean;
  /** Refused levers not chosen, which are part of that remaining choice. */
  readonly remainingRefused: readonly string[];
  readonly options: readonly LeverOption[];
}

export type SelectionResult =
  | { readonly ok: true; readonly value: SelectionPreview }
  | { readonly ok: false; readonly refusal: SelectionRefusal };

function refuse(refusal: SelectionRefusal): SelectionResult {
  return { ok: false, refusal };
}

function checkOne(
  option: LeverOption | undefined,
  id: string,
  showAnyway: ReadonlySet<string>,
): SelectionRefusal | null {
  // A known lever with no option means the plan is within budget and nothing is on offer.
  if (option === undefined) return { kind: 'not-offered', id };
  switch (option.status) {
    case 'disabled':
      return { kind: 'lever-disabled', id, reason: option.reason };
    case 'not-applicable':
      return { kind: 'lever-not-applicable', id, reason: option.reason };
    case 'refused':
      return option.showAnywayAllowed && showAnyway.has(id)
        ? null
        : { kind: 'lever-refused', id, reason: option.reason };
    case 'offered':
      return null;
  }
}

export function previewSelection(input: SelectionInput): SelectionResult {
  const plain: ProjectionInput = { ...input.base, evidence: withoutLevers(input.base.evidence) };
  const baseline = projectSpend(plain);
  if (!baseline.ok) return refuse({ kind: 'budget', reason: baseline.reason });
  const chosen = new Set(input.selected);
  const application = applyLevers({ base: plain, levers: input.levers, selected: [...chosen] });
  if (!application.ok) return refuse({ kind: 'budget', reason: application.reason });
  // The raise is priced on the gap left once the selection is in, as the plan page prices it.
  const options = leverOptions(input, baseline.value, {
    gapInr: application.value.projection.gap.inr,
    chosen: [...chosen],
  });
  if (!options.ok) return refuse({ kind: 'budget', reason: options.reason });
  const showAnyway = new Set(input.showAnyway);
  for (const id of chosen) {
    if (!input.levers.some((row) => row.id === id)) return refuse({ kind: 'unknown-lever', id });
    const refusal = checkOne(
      options.value.find((option) => option.id === id),
      id,
      showAnyway,
    );
    if (refusal !== null) return refuse(refusal);
  }
  const { projection } = application.value;
  const onOffer = options.value.filter(
    (option) => option.status === 'offered' && option.effect !== 'raiseBudget',
  );
  return {
    ok: true,
    value: {
      canApply: chosen.size > 0,
      selected: input.levers.filter((row) => chosen.has(row.id)).map((row) => row.id),
      application: application.value,
      line: runningLine(application.value.closedInr, projection.gap.inr),
      exhausted:
        projection.gap.inr > 0 &&
        onOffer.length > 0 &&
        onOffer.every((option) => chosen.has(option.id)),
      remainingRefused: options.value
        .filter((option) => option.status === 'refused' && !chosen.has(option.id))
        .map((option) => option.id),
      options: options.value,
    },
  };
}
