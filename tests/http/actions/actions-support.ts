// Shared pieces for the task, lever and messages boundary tests: sealed plans from the spec
// fixtures, a Location reader that keeps anchors and the lever query, and the opened view.

import { viewOfOps, type PlanView } from '@/core/plan/plan-view';
import type { Op } from '@/schemas/plan/op';
import type { StateToken } from '@/schemas/plan/state-token';

import { AI_READ, BRIEF_OP, OVER_BUDGET_QUOTES } from '../../fixtures/plan-readings';
import { DATA, location, seal, stateOf, TODAY } from '../support';

/** Spec 5.3: the 8 lakh, 200 guest brief plus three quotes, over budget by Rs 1,57,000. */
export const OVER_BUDGET_OPS: readonly Op[] = [
  BRIEF_OP,
  ...OVER_BUDGET_QUOTES.map((quote): Op => ({ kind: 'quoteAdded', quote, readBy: AI_READ })),
];

export function tokenFor(ops: readonly Op[]): string {
  const state: StateToken = { schema: 1, ops: [...ops] };
  return seal(state);
}

export const BRIEF_TOKEN = tokenFor([BRIEF_OP]);
export const OVER_BUDGET_TOKEN = tokenFor(OVER_BUDGET_OPS);

const PLAN_LOCATION =
  /^\/(en|hi)\/p\/([A-Za-z0-9_-]+)(\/[a-z]+)?(\?[a-z]+=[a-z0-9,-]+(?:&[a-z]+=[a-z0-9,-]+)*)?(#[a-z-]+)?$/;

export interface PlanLocation {
  readonly lang: string;
  readonly token: string;
  readonly page: string;
  readonly query: string;
  readonly anchor: string;
}

/** Splits a 303's relative Location; throws for anything that is not a plan page. */
export function planLocation(response: Response): PlanLocation {
  const match = PLAN_LOCATION.exec(location(response));
  if (match === null) throw new Error(`not a plan location: ${location(response)}`);
  return {
    lang: match[1] ?? '',
    token: match[2] ?? '',
    page: match[3] ?? '',
    query: match[4] ?? '',
    anchor: match[5] ?? '',
  };
}

export function opsOf(token: string): readonly Op[] {
  return stateOf(token).ops;
}

export function viewOf(ops: readonly Op[]): PlanView {
  const view = viewOfOps(ops, DATA, TODAY);
  if (!view.ok) throw new Error(`refused: ${JSON.stringify(view.refusal)}`);
  return view.value;
}
