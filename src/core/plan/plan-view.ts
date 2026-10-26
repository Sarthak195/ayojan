// Everything the pages show, computed once per request from the ops, the data and `today`
// (architecture 3 "Derived, never stored", 6.1). The current version carries the numbers; the
// revision compares the version just before the latest change with the version that change
// produced (D32), while re-confirmation, vendor questions and levers use the current plan.

import type { IsoDate } from '@/core/calendar/day-number';
import type { Op } from '@/schemas/plan/op';

import type { MessageFactsInput } from '../messages/fact-types';
import { diffVersions, type DiffRow } from './diff';
import { fold, previewInputs } from './fold';
import { keptDecisions, type KeptDecisions } from './kept';
import { ledgerRows, type LedgerRow } from './ledger';
import type { PlanData } from './plan-data';
import type { PlanInputs } from './plan-inputs';
import { messageFactsInput } from './plan-messages';
import { planOk, type PlanResult } from './plan-refusal';
import { vendorContacts, type VendorContact } from './plan-vendors';
import { planVersion, type PlanVersion } from './plan-version';
import { reconfirmations, type ReconfirmationItem } from './reconfirmation';

export type Banner =
  | { readonly kind: 'small-celebration-profile' }
  | { readonly kind: 'short-notice'; readonly daysToEvent: number }
  | { readonly kind: 'over-budget'; readonly gapInr: number };

export interface Revision {
  /** Ops folded by the version before the latest change, and by the change itself. */
  readonly beforeVersion: number;
  readonly afterVersion: number;
  readonly rows: readonly DiffRow[];
  readonly kept: KeptDecisions;
}

export interface PlanView {
  readonly current: PlanVersion;
  /** Null until the plan has a confirmed change. */
  readonly revision: Revision | null;
  readonly reconfirmations: readonly ReconfirmationItem[];
  readonly vendors: readonly VendorContact[];
  readonly ledger: readonly LedgerRow[];
  readonly messageFacts: MessageFactsInput;
  readonly banners: readonly Banner[];
}

function bannersOf(current: PlanVersion): Banner[] {
  const banners: Banner[] = [];
  if (current.profile === 'celebration') banners.push({ kind: 'small-celebration-profile' });
  const { schedule, headline } = current;
  if (schedule.shortNotice) {
    banners.push({ kind: 'short-notice', daysToEvent: schedule.daysToEvent });
  }
  if (headline.status === 'over-budget') {
    banners.push({ kind: 'over-budget', gapInr: headline.gap.inr });
  }
  return banners;
}

function versionAt(
  ops: readonly Op[],
  count: number,
  data: PlanData,
  today: IsoDate,
): PlanResult<PlanVersion> {
  const inputs = fold(ops.slice(0, count), data);
  return inputs.ok ? planVersion(inputs.value, data, today) : inputs;
}

interface RevisionParts {
  readonly before: PlanVersion;
  readonly revision: Revision;
  readonly items: readonly ReconfirmationItem[];
}

function revisionOf(
  inputs: PlanInputs,
  current: PlanVersion,
  data: PlanData,
  today: IsoDate,
): PlanResult<RevisionParts | null> {
  const index = inputs.latestChange;
  if (index === null) return planOk(null);
  const before = versionAt(inputs.ops, index, data, today);
  if (!before.ok) return before;
  const isLast = index + 1 === inputs.ops.length;
  const after = isLast ? planOk(current) : versionAt(inputs.ops, index + 1, data, today);
  if (!after.ok) return after;
  // Kept is judged at the change, but "ask again" follows the vendors as they stand now.
  const items = reconfirmations(before.value, current);
  return planOk({
    before: before.value,
    items,
    revision: {
      beforeVersion: before.value.version,
      afterVersion: after.value.version,
      rows: diffVersions(before.value, after.value, data),
      kept: keptDecisions(before.value, after.value, items),
    },
  });
}

export function planView(inputs: PlanInputs, data: PlanData, today: IsoDate): PlanResult<PlanView> {
  const current = planVersion(inputs, data, today);
  if (!current.ok) return current;
  const revision = revisionOf(inputs, current.value, data, today);
  if (!revision.ok) return revision;
  const before = revision.value?.before ?? null;
  const items = revision.value?.items ?? [];
  const vendors = vendorContacts(current.value, items, data);
  return planOk({
    current: current.value,
    revision: revision.value?.revision ?? null,
    reconfirmations: items,
    vendors,
    ledger: ledgerRows(inputs.ops, data),
    messageFacts: messageFactsInput(current.value, before, vendors, data),
    banners: bannersOf(current.value),
  });
}

/** Folds the ops and computes the view: what a page loader calls once per request. */
export function viewOfOps(
  ops: readonly Op[],
  data: PlanData,
  today: IsoDate,
): PlanResult<PlanView> {
  const inputs = fold(ops, data);
  return inputs.ok ? planView(inputs.value, data, today) : inputs;
}

/** The view with one more op, without committing it (architecture 4.3). */
export function previewOp(
  ops: readonly Op[],
  candidate: Op,
  data: PlanData,
  today: IsoDate,
): PlanResult<PlanView> {
  const inputs = previewInputs(ops, candidate, data);
  return inputs.ok ? planView(inputs.value, data, today) : inputs;
}
