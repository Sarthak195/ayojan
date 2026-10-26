// The checked ops of a plan plus the few facts later ops are validated against. Inputs only:
// no rupee and no date is computed here, so what the link holds and what the pages show can
// never drift apart; plan-view derives every number from these on each request.

import type { LeverId } from '@/schemas/generated/ids';
import type { Brief } from '@/schemas/plan/brief';
import type { Op } from '@/schemas/plan/op';
import type { QuoteRecord } from '@/schemas/plan/quote-record';

import type { ProfileId } from '../budget/budget-profile';
import type { TaskSelection } from '../timeline/task-selection';

export type BriefOp = Extract<Op, { kind: 'briefConfirmed' }>;
export type ChangeOp = Extract<Op, { kind: 'changeConfirmed' }>;
export type LeversOp = Extract<Op, { kind: 'leversApplied' }>;

export interface PlanInputs {
  /** Every op so far, the brief first; the ledger and Undo read these. */
  readonly ops: readonly Op[];
  readonly brief: Brief;
  readonly profile: ProfileId;
  /** Fixed by the brief: functions, must-haves and needs never change after it. */
  readonly selection: TaskSelection;
  readonly quotes: readonly QuoteRecord[];
  readonly doneTaskIds: readonly string[];
  /** Every lever chosen so far, in data order; later choices add to earlier ones. */
  readonly leverIds: readonly LeverId[];
  /** The index in `ops` of the latest changeConfirmed, or null before any change. */
  readonly latestChange: number | null;
}

export function briefOpOf(inputs: PlanInputs): BriefOp | null {
  const first = inputs.ops[0];
  return first?.kind === 'briefConfirmed' ? first : null;
}
