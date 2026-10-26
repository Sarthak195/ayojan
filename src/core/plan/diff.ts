// The revision diff (architecture 4.8, FR-25, D32): what changed between two versions of the
// plan, one row per changed value, each with the reason code of its cause. Unchanged values are
// left out. The revision page compares the version just before the latest change with the
// version that change produced; any other pair is an internal comparison for tests.

import type { IsoDate } from '@/core/calendar/day-number';
import type { QuoteSlot } from '@/schemas/plan/quote-record';
import type { Category } from '@/schemas/readings/vocabulary';

import type { ProjectedLine } from '../budget/projection';
import type { MoveMoneyOutcome } from '../budget/reallocation';
import type { Money } from '../money/money';
import type { TaskStatus } from '../timeline/status';
import { moneyReason, raisedInr, taskReason, type ReasonCode } from './diff-reasons';
import type { PlanData } from './plan-data';
import type { PlanVersion } from './plan-version';

export type { ReasonCode } from './diff-reasons';

interface Change<T> {
  readonly before: T;
  readonly after: T;
}

type LineFacts = Pick<ProjectedLine, 'allocation' | 'projected' | 'source'>;

interface TaskFacts {
  readonly latestFinish: IsoDate;
  readonly slackDays: number;
  readonly status: TaskStatus;
}

export type DiffRow =
  | ({ readonly kind: 'guests'; readonly reason: ReasonCode } & Change<number>)
  | ({ readonly kind: 'budget'; readonly reason: ReasonCode } & Change<Money>)
  | ({ readonly kind: 'eventDate'; readonly reason: ReasonCode } & Change<IsoDate>)
  | ({ readonly kind: 'projected'; readonly reason: ReasonCode } & Change<Money>)
  | ({ readonly kind: 'gap'; readonly reason: ReasonCode } & Change<Money>)
  | ({
      readonly kind: 'money';
      readonly category: Category;
      /** Named beside a guests-changed row: "grows with guests at 20 percent". */
      readonly perGuestSharePercent: number;
      readonly reason: ReasonCode;
    } & Change<LineFacts>)
  | {
      readonly kind: 'reallocation';
      readonly opIndex: number;
      readonly outcome: MoveMoneyOutcome;
      readonly reason: 'reallocated';
    }
  | ({
      readonly kind: 'ranking';
      readonly category: Category;
      /** The break-even guest count the change crossed, when the earlier version knew it. */
      readonly crossedAtGuests: number | null;
      readonly reason: 'ranking-flipped';
    } & Change<QuoteSlot | null>)
  | ({
      readonly kind: 'venueFit';
      readonly capacity: number;
      readonly fitsAfter: boolean;
      readonly reason: ReasonCode;
    } & Change<number>)
  | ({
      readonly kind: 'task';
      readonly taskId: string;
      readonly name: { readonly en: string; readonly hi: string };
      readonly reason: ReasonCode;
    } & Change<TaskFacts>);

function headlineRows(before: PlanVersion, after: PlanVersion, moneyRows: DiffRow[]): DiffRow[] {
  const rows: DiffRow[] = [];
  const a = before.headline;
  const b = after.headline;
  if (a.guests !== b.guests) {
    rows.push({ kind: 'guests', before: a.guests, after: b.guests, reason: 'guests-changed' });
  }
  const raised = raisedInr(after) - raisedInr(before);
  const budgetReason: ReasonCode =
    raised !== 0 && b.budget.inr - a.budget.inr === raised
      ? 'lever-applied:raise-budget'
      : 'budget-changed';
  if (a.budget.inr !== b.budget.inr) {
    rows.push({ kind: 'budget', before: a.budget, after: b.budget, reason: budgetReason });
  }
  if (a.eventDate !== b.eventDate) {
    rows.push({
      kind: 'eventDate',
      before: a.eventDate,
      after: b.eventDate,
      reason: 'event-date-moved',
    });
  }
  const totalReason = moneyRows.find((row) => row.kind === 'money')?.reason ?? 'guests-changed';
  if (a.projected.inr !== b.projected.inr) {
    rows.push({ kind: 'projected', before: a.projected, after: b.projected, reason: totalReason });
  }
  if (a.gap.inr !== b.gap.inr) {
    const reason = a.budget.inr === b.budget.inr ? totalReason : budgetReason;
    rows.push({ kind: 'gap', before: a.gap, after: b.gap, reason });
  }
  return rows;
}

function moneyRows(before: PlanVersion, after: PlanVersion): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const category of after.money.projection.order) {
    const a = before.money.projection.lines[category];
    const b = after.money.projection.lines[category];
    const same =
      a.allocation.inr === b.allocation.inr &&
      a.projected.inr === b.projected.inr &&
      a.projected.provenance === b.projected.provenance &&
      a.source === b.source;
    if (same) continue;
    rows.push({
      kind: 'money',
      category,
      perGuestSharePercent: after.money.input.split.lines[category].perGuestSharePercent,
      before: { allocation: a.allocation, projected: a.projected, source: a.source },
      after: { allocation: b.allocation, projected: b.projected, source: b.source },
      reason: moneyReason(before, after, category),
    });
  }
  const known = new Set(before.money.moves.map((move) => move.opIndex));
  for (const move of after.money.moves) {
    if (known.has(move.opIndex)) continue;
    rows.push({
      kind: 'reallocation',
      opIndex: move.opIndex,
      outcome: move.outcome,
      reason: 'reallocated',
    });
  }
  return rows;
}

function cheapestIn(version: PlanVersion, category: Category): QuoteSlot | null {
  const found = version.comparisons.find((comparison) => comparison.category === category);
  return found?.ranking[0] ?? null;
}

function crossedAt(
  before: PlanVersion,
  after: PlanVersion,
  category: Category,
  winner: QuoteSlot | null,
): number | null {
  const comparison = before.comparisons.find((candidate) => candidate.category === category);
  const rising = after.headline.guests > before.headline.guests;
  for (const found of comparison?.breakEvens ?? []) {
    if (found.kind !== 'compared') continue;
    if (rising && found.above?.cheaper === winner) return found.above.fromGuests;
    if (!rising && found.below?.cheaper === winner) return found.below.belowGuests;
  }
  return null;
}

function rankingRows(before: PlanVersion, after: PlanVersion): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const category of after.money.projection.order) {
    const a = cheapestIn(before, category);
    const b = cheapestIn(after, category);
    if (a === b) continue;
    rows.push({
      kind: 'ranking',
      category,
      before: a,
      after: b,
      crossedAtGuests: crossedAt(before, after, category, b),
      reason: 'ranking-flipped',
    });
  }
  return rows;
}

function venueRows(before: PlanVersion, after: PlanVersion): DiffRow[] {
  const { capacity } = after.headline.venue;
  const guests = { before: before.headline.guests, after: after.headline.guests };
  const capacityMoved = before.headline.venue.capacity !== capacity;
  if (capacity === null || (guests.before === guests.after && !capacityMoved)) return [];
  const booking = after.bookings.find((candidate) => candidate.category === 'venue');
  const reason: ReasonCode =
    guests.before !== guests.after || booking === undefined
      ? 'guests-changed'
      : `task-done:${booking.taskId}`;
  return [{ kind: 'venueFit', capacity, ...guests, fitsAfter: guests.after <= capacity, reason }];
}

function taskRows(before: PlanVersion, after: PlanVersion, data: PlanData): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const task of after.schedule.tasks) {
    const earlier = before.schedule.tasks.find((candidate) => candidate.id === task.id);
    // A task finished in both versions asks nothing more of the family, so it gets no row.
    if (earlier === undefined || (earlier.done && task.done)) continue;
    const same =
      earlier.latestFinish === task.latestFinish &&
      earlier.slackDays === task.slackDays &&
      earlier.status === task.status;
    if (same) continue;
    const facts = (from: typeof task): TaskFacts => ({
      latestFinish: from.latestFinish,
      slackDays: from.slackDays,
      status: from.status,
    });
    rows.push({
      kind: 'task',
      taskId: task.id,
      name: { en: task.en, hi: task.hi },
      before: facts(earlier),
      after: facts(task),
      reason: taskReason(before, after, task.id, data),
    });
  }
  return rows;
}

/** Changed rows only, headline first, then money, ranking, venue fit and tasks. */
export function diffVersions(
  before: PlanVersion,
  after: PlanVersion,
  data: PlanData,
): readonly DiffRow[] {
  const money = moneyRows(before, after);
  return [
    ...headlineRows(before, after, money),
    ...money,
    ...rankingRows(before, after),
    ...venueRows(before, after),
    ...taskRows(before, after, data),
  ];
}
