// Shared pieces for the change tests: the spec 5.2 plan before the change (venue booked at
// Rs 1,80,000 for 220, decorator delayed to 10 Nov, quotes A and B) sealed directly, the
// recorded change readings, and helpers that follow a 303 by hand.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ReadDeps } from '@/app/[lang]/read/[kind]/read-step';
import { headlineOf } from '@/app/[lang]/p/[token]/_change/change-values';
import type { PlanView } from '@/core/plan/plan-view';
import type { Op } from '@/schemas/plan/op';
import { openPlan } from '@/server/view/plan-page';

import { fakeLlmGateway, type FakeLlmGateway, type FakeReply } from '../../fakes/llm-gateway';
import { AI_READ, BRIEF_OP, CATERER_A, CATERER_B } from '../../fixtures/plan-readings';
import { deps, location, NO_EXAMPLES, seal, sources, TODAY } from '../support';

export { context, deps, location, post, stateOf, DATA, TODAY } from '../support';

function repoText(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function recordedReply(name: string): unknown {
  const recording: unknown = JSON.parse(repoText(`golden/llm/${name}.change.json`));
  return typeof recording === 'object' && recording !== null && 'reply' in recording
    ? recording.reply
    : null;
}

/** The explainer's sentence exactly as committed, and the reply recorded for it. */
export const EXPLAINER_TEXT = repoText('fixtures/change-explainer-sentence.txt');
export const EXPLAINER_REPLY = recordedReply('change-explainer-sentence');
export const DATE_CONFLICT_TEXT = repoText('fixtures/change-date-conflict.txt');
export const DATE_CONFLICT_REPLY = recordedReply('change-date-conflict');

/** Spec 5.2 v5: the plan the explainer's sentence changes. */
export const SPEC_OPS: readonly Op[] = [
  BRIEF_OP,
  { kind: 'taskDone', taskId: 'book-venue', on: TODAY, amountInr: 180_000, capacity: 220 },
  { kind: 'taskDelayed', taskId: 'book-decorator', notBefore: '2026-11-10' },
  { kind: 'quoteAdded', quote: CATERER_A, readBy: AI_READ },
  { kind: 'quoteAdded', quote: CATERER_B, readBy: AI_READ },
];

export function specToken(): string {
  return seal({ schema: 1, ops: [...SPEC_OPS] });
}

/** Read-route deps whose fake gateway answers the change prompt with `reply`. */
export function changeDeps(reply: FakeReply): {
  readonly gateway: FakeLlmGateway;
  readonly deps: ReadDeps;
} {
  const gateway = fakeLlmGateway(new Map([['change', reply]]));
  return { gateway, deps: { ...deps(), gateway, examples: NO_EXAMPLES } };
}

const PAGE_LOCATION = /^\/(?:en|hi)\/p\/([A-Za-z0-9_-]+)(\/[a-z]+)?(?:\?[^#]*)?(?:#[a-z-]+)?$/;

/** The token of a 303 to `/p/<token><suffix>`; throws on any other Location. */
export function tokenAt(response: Response, suffix: '' | '/check' | '/revision'): string {
  const match = PAGE_LOCATION.exec(location(response));
  if (match?.[1] === undefined || (match[2] ?? '') !== suffix) {
    throw new Error(`not a ${suffix || 'plan'} location: ${location(response)}`);
  }
  return match[1];
}

export interface Opened {
  readonly view: PlanView;
  readonly plan: Extract<ReturnType<typeof openPlan>, { ok: true }>['plan'];
}

/** The token as a plan with a view, or a throw. */
export function opened(token: string): Opened {
  const result = openPlan(token, sources());
  if (!result.ok || result.plan.view === null) throw new Error('plan did not open');
  return { view: result.plan.view, plan: result.plan };
}

export { headlineOf };
