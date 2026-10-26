// What a change kept (architecture 4.8, D29, FR-26). Every decision the family made has a stable
// key; a decision is kept when its key is in both versions with an equal value. Kept decisions
// whose vendor must now confirm again are listed apart, as "Kept, ask again", and still count:
// the counter "Revised, not restarted: N of M decisions kept" always equals the two lists.

import { FunctionName } from '@/schemas/readings/vocabulary';

import type { PlanVersion } from './plan-version';
import { sameVendor, type ReconfirmationItem, type VendorRef } from './reconfirmation';

export type DecisionKind =
  | 'priority'
  | 'mustHave'
  | 'need'
  | 'diet'
  | 'venueLimit'
  | 'function'
  | 'booking'
  | 'quote'
  | 'taskEvent'
  | 'lever';

export interface Decision {
  /** `priority:catering`, `booking:venue`, `taskEvent:book-decorator`, ... */
  readonly key: string;
  readonly kind: DecisionKind;
  /** Canonical JSON of the value, so equality is a string comparison. */
  readonly value: string;
  /** The vendor behind a booking or quote decision, which may need to confirm again. */
  readonly vendor: VendorRef | null;
}

export interface KeptDecisions {
  readonly kept: readonly Decision[];
  readonly keptAskAgain: readonly Decision[];
  /** Decisions of the earlier version whose value changed or that are gone. */
  readonly changed: readonly Decision[];
  /** Decisions made since; they are not part of the count. */
  readonly added: readonly Decision[];
  readonly counter: { readonly kept: number; readonly total: number };
}

function decision(
  kind: DecisionKind,
  id: string,
  value: unknown,
  vendor: VendorRef | null = null,
): Decision {
  return { key: `${kind}:${id}`, kind, value: JSON.stringify(value), vendor };
}

/** The decision set of one version, in a fixed order. */
export function decisionsOf(version: PlanVersion): Decision[] {
  const { brief } = version;
  const decisions: Decision[] = [];
  for (const category of version.money.projection.order) {
    decisions.push(decision('priority', category, version.priorities[category]));
  }
  for (const item of brief.mustHaves) decisions.push(decision('mustHave', item, true));
  for (const need of brief.needs) decisions.push(decision('need', need, true));
  for (const item of brief.diet) decisions.push(decision('diet', item, true));
  for (const item of brief.venueLimits) decisions.push(decision('venueLimit', item, true));
  for (const name of FunctionName.options) {
    decisions.push(decision('function', name, brief.functions[name]));
  }
  const bookingTasks = new Set<string>();
  for (const booking of version.bookings) {
    bookingTasks.add(booking.taskId);
    const { taskId, amountInr, capacity } = booking;
    const vendor: VendorRef = { kind: 'booking', category: booking.category, taskId };
    decisions.push(decision('booking', booking.category, { taskId, amountInr, capacity }, vendor));
  }
  for (const quote of version.quotes) {
    const vendor: VendorRef = { kind: 'quote', category: quote.category, quoteId: quote.id };
    decisions.push(decision('quote', quote.id, quote, vendor));
  }
  for (const task of version.schedule.tasks) {
    // A booking task is already counted as its booking, so the venue is not listed twice.
    if (bookingTasks.has(task.id) || (task.doneOn === null && task.notBefore === null)) continue;
    decisions.push(
      decision('taskEvent', task.id, { doneOn: task.doneOn, notBefore: task.notBefore }),
    );
  }
  for (const id of version.leverIds) decisions.push(decision('lever', id, true));
  return decisions;
}

export function keptDecisions(
  before: PlanVersion,
  after: PlanVersion,
  reconfirm: readonly ReconfirmationItem[],
): KeptDecisions {
  const later = new Map(decisionsOf(after).map((item) => [item.key, item]));
  const earlier = decisionsOf(before);
  const earlierKeys = new Set(earlier.map((item) => item.key));
  const kept: Decision[] = [];
  const keptAskAgain: Decision[] = [];
  const changed: Decision[] = [];
  for (const item of earlier) {
    if (later.get(item.key)?.value !== item.value) {
      changed.push(item);
      continue;
    }
    const { vendor } = item;
    const askAgain = vendor !== null && reconfirm.some((entry) => sameVendor(entry.vendor, vendor));
    (askAgain ? keptAskAgain : kept).push(item);
  }
  return {
    kept,
    keptAskAgain,
    changed,
    added: [...later.values()].filter((item) => !earlierKeys.has(item.key)),
    counter: { kept: kept.length + keptAskAgain.length, total: earlier.length },
  };
}
