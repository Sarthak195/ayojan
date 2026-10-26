import 'server-only';

import type { IsoDate } from '@/core/calendar/day-number';
import { applyLevers } from '@/core/levers/lever-application';
import type { LeverOption } from '@/core/levers/lever-types';
import { runningLine, runningLineSentence, type RunningLine } from '@/core/levers/running-line';
import type { PlanData } from '@/core/plan/plan-data';
import { RAISE_BUDGET_ID } from '@/core/plan/plan-money';
import { planOk, type PlanResult } from '@/core/plan/plan-refusal';
import type { PlanVersion } from '@/core/plan/plan-version';
import { previewOp, type PlanView } from '@/core/plan/plan-view';
import type { TaskStatus } from '@/core/timeline/status';
import type { Lang } from '@/i18n/lang';
import { LeverId } from '@/schemas/generated/ids';
import type { Op } from '@/schemas/plan/op';

// The lever route's contract with the plan module (arch 4.5, FR-32). Levers chosen earlier stay
// in force and are never offered again; a new choice is checked against the plan as it stands
// (disabled, or refused without "Show anyway", is refused here); the raise is sent only when it
// was ticked this time and still has rupees to add after the other ticks. Every total comes
// from the fold through previewOp, so a client figure is never read.

export type Ticked =
  { readonly ok: true; readonly fresh: readonly LeverId[] } | { readonly ok: false };

function isChosen(current: PlanVersion, id: string): boolean {
  return current.leverIds.some((chosen) => chosen === id);
}

/** Levers already in force on this plan, in data order. */
export function chosenOptions(current: PlanVersion): readonly LeverOption[] {
  return current.money.options.filter((option) => isChosen(current, option.id));
}

/** Levers a tick could add now: on offer, or refused but allowed behind "Show anyway". */
export function tickable(current: PlanVersion): readonly LeverOption[] {
  return current.money.options.filter(
    (option) =>
      !isChosen(current, option.id) &&
      (option.status === 'offered' || (option.status === 'refused' && option.showAnywayAllowed)),
  );
}

/** Checks a posted selection; already chosen ids are dropped, anything not allowed refuses. */
export function checkTicked(
  current: PlanVersion,
  ticked: readonly string[],
  showAnyway: readonly string[],
): Ticked {
  for (const id of ticked) {
    if (isChosen(current, id)) continue;
    const option = current.money.options.find((each) => each.id === id);
    if (option === undefined || option.status === 'disabled') return { ok: false };
    if (option.status === 'not-applicable') return { ok: false };
    if (option.status === 'refused' && !(option.showAnywayAllowed && showAnyway.includes(id))) {
      return { ok: false };
    }
  }
  const fresh = tickable(current)
    .filter((option) => ticked.includes(option.id))
    .flatMap((option) => {
      const id = LeverId.safeParse(option.id);
      return id.success ? [id.data] : [];
    });
  return { ok: true, fresh };
}

/** The one leversApplied op for a checked selection, or null when it changes nothing. */
export function candidateOp(
  ops: readonly Op[],
  view: PlanView,
  fresh: readonly LeverId[],
  data: PlanData,
  today: IsoDate,
): PlanResult<Op | null> {
  const cuts = fresh.filter((id) => id !== RAISE_BUDGET_ID);
  const raiseTicked = fresh.length !== cuts.length;
  let gap = view.current.headline.gap.inr;
  if (raiseTicked && cuts.length > 0) {
    const cut: Op = { kind: 'leversApplied', leverIds: cuts, raiseBudgetInr: null };
    const after = previewOp(ops, cut, data, today);
    if (!after.ok) return after;
    gap = after.value.current.headline.gap.inr;
  }
  const raise = raiseTicked ? Math.max(0, gap) : 0;
  const leverIds = raise > 0 ? [...cuts, RAISE_BUDGET_ID] : cuts;
  if (leverIds.length === 0) return planOk(null);
  return planOk({ kind: 'leversApplied', leverIds, raiseBudgetInr: raise > 0 ? raise : null });
}

export interface ClearedTask {
  readonly taskId: string;
  readonly name: string;
  readonly before: TaskStatus;
}

export interface LeverPreview {
  readonly line: RunningLine;
  /** Every lever on offer is chosen and the plan is still over budget. */
  readonly exhausted: boolean;
  /** Tasks a faster alternative takes out of At risk or Late (FR-33), from the scheduler. */
  readonly cleared: readonly ClearedTask[];
}

const SLIPPING: readonly TaskStatus[] = ['atRisk', 'late'];

function clearedTasks(before: PlanVersion, after: PlanVersion, lang: Lang): ClearedTask[] {
  return after.schedule.tasks.flatMap((task) => {
    const earlier = before.schedule.tasks.find((each) => each.id === task.id);
    if (earlier === undefined || earlier.fasterApplied || !task.fasterApplied) return [];
    if (!SLIPPING.includes(earlier.status) || SLIPPING.includes(task.status)) return [];
    return [{ taskId: task.id, name: task[lang], before: earlier.status }];
  });
}

/** The running line for an op through the same fold every page runs (the no-JavaScript path). */
export function previewOf(
  ops: readonly Op[],
  view: PlanView,
  op: Op | null,
  data: PlanData,
  today: IsoDate,
  lang: Lang,
): PlanResult<LeverPreview> {
  const { current } = view;
  let after = current;
  if (op !== null) {
    const preview = previewOp(ops, op, data, today);
    if (!preview.ok) return preview;
    after = preview.value.current;
  }
  const gap = after.headline.gap.inr;
  const onOffer = current.money.options.filter(
    (option) => option.status === 'offered' && option.effect !== 'raiseBudget',
  );
  const picked = op?.kind === 'leversApplied' ? op.leverIds : [];
  return planOk({
    line: runningLine(current.headline.gap.inr - gap, gap),
    exhausted:
      gap > 0 &&
      onOffer.length > 0 &&
      onOffer.every(
        (option) => isChosen(current, option.id) || picked.some((id) => id === option.id),
      ),
    cleared: clearedTasks(current, after, lang),
  });
}

/** The island's limit: 2^8 sentences is still a small page. */
const MAX_TABLE_LEVERS = 8;

/**
 * Every running line the island could need, computed here by the same lever arithmetic the
 * fold runs, keyed by the ticked ids in data order. The island looks a sentence up; it does no
 * sums of its own, so overlapping levers cannot make it disagree with the server.
 */
export function runningTable(
  current: PlanVersion,
  data: PlanData,
  lang: Lang,
): Readonly<Record<string, string>> | null {
  const ids = tickable(current).map((option) => option.id);
  if (ids.length > MAX_TABLE_LEVERS) return null;
  const inForce = current.leverIds.filter((id) => id !== RAISE_BUDGET_ID);
  const table: Record<string, string> = {};
  for (let mask = 0; mask < 1 << ids.length; mask += 1) {
    const subset = ids.filter((_, index) => (mask & (1 << index)) !== 0);
    const applied = applyLevers({
      base: current.money.input,
      levers: data.levers.levers,
      selected: [...inForce, ...subset],
    });
    if (!applied.ok) return null;
    const gap = applied.value.projection.gap.inr;
    const line = runningLine(current.headline.gap.inr - gap, gap);
    table[subset.join(',')] = runningLineSentence(line, lang);
  }
  return table;
}
