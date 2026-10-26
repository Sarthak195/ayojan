import { parseIsoDate, type IsoDate } from '@/core/calendar/day-number';
import { fold } from '@/core/plan/fold';
import type { PlanData } from '@/core/plan/plan-data';
import type { PlanInputs } from '@/core/plan/plan-inputs';
import { viewOfOps, type PlanView } from '@/core/plan/plan-view';
import { planVersion, type PlanVersion } from '@/core/plan/plan-version';
import type { Brief } from '@/schemas/plan/brief';
import type { Op } from '@/schemas/plan/op';

import {
  AI_READ,
  BRIEF_OP,
  CATERER_A,
  CATERER_B,
  FORM_READ,
  HINGLISH_BRIEF,
  PLAN_DATA,
  SPEC_PRIORITIES,
  TODAY,
} from '../../../fixtures/plan-readings';

export { AI_READ, BRIEF_OP, CATERER_A, CATERER_B, FORM_READ, HINGLISH_BRIEF, PLAN_DATA };

export function isoDate(text: string): IsoDate {
  const parsed = parseIsoDate(text);
  if (!parsed.ok) throw new Error(`bad date ${text}`);
  return parsed.value;
}

export const today = isoDate(TODAY);

export function inputsOf(ops: readonly Op[], data: PlanData = PLAN_DATA): PlanInputs {
  const folded = fold(ops, data);
  if (!folded.ok) throw new Error(`refused: ${JSON.stringify(folded.refusal)}`);
  return folded.value;
}

export function versionOf(ops: readonly Op[], when: IsoDate = today): PlanVersion {
  const version = planVersion(inputsOf(ops), PLAN_DATA, when);
  if (!version.ok) throw new Error(`refused: ${JSON.stringify(version.refusal)}`);
  return version.value;
}

export function viewOf(ops: readonly Op[], when: IsoDate = today): PlanView {
  const view = viewOfOps(ops, PLAN_DATA, when);
  if (!view.ok) throw new Error(`refused: ${JSON.stringify(view.refusal)}`);
  return view.value;
}

export function briefOp(changes: Partial<Brief> = {}): Op {
  return { kind: 'briefConfirmed', brief: { ...HINGLISH_BRIEF, ...changes }, readBy: AI_READ };
}

export const VENUE_BOOKED: Op = {
  kind: 'taskDone',
  taskId: 'book-venue',
  on: TODAY,
  amountInr: 180_000,
  capacity: 220,
};

// The date delayTask gives for a 10-day delay after the venue booking; the golden change test
// computes it through delayTask, this unit fixture pins it by hand.
export const DECORATOR_DELAYED: Op = {
  kind: 'taskDelayed',
  taskId: 'book-decorator',
  notBefore: '2026-11-10',
};

export const QUOTE_A: Op = { kind: 'quoteAdded', quote: CATERER_A, readBy: AI_READ };
export const QUOTE_B: Op = { kind: 'quoteAdded', quote: CATERER_B, readBy: AI_READ };

export function change(fields: Partial<Extract<Op, { kind: 'changeConfirmed' }>> = {}): Op {
  return {
    kind: 'changeConfirmed',
    guests: null,
    budgetInr: null,
    eventDate: null,
    reallocate: null,
    priorities: null,
    sources: [],
    readBy: FORM_READ,
    ...fields,
  };
}

export const EXPLAINER_CHANGE = change({
  guests: 250,
  budgetInr: 750_000,
  eventDate: '2027-02-12',
  sources: ['50 more guests', 'our budget has decreased a bit', '2 weeks earlier'],
  readBy: AI_READ,
});

export const LEVERS: Op = {
  kind: 'leversApplied',
  leverIds: ['e-invites', 'half-contingency'],
  raiseBudgetInr: null,
};

export const MOVE_TO_PHOTO = change({
  reallocate: { to: 'photo', amountInr: 40_000 },
  priorities: { ...SPEC_PRIORITIES, catering: 'standard' },
});

/** Spec 5.2 as ops: v1 brief to v8 the second change. */
export const SPEC_OPS: readonly Op[] = [
  BRIEF_OP,
  VENUE_BOOKED,
  DECORATOR_DELAYED,
  QUOTE_A,
  QUOTE_B,
  EXPLAINER_CHANGE,
  LEVERS,
  MOVE_TO_PHOTO,
];

export function first(count: number): Op[] {
  return SPEC_OPS.slice(0, count);
}
