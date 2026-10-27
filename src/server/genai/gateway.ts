import 'server-only';

import { log, type Logger } from '@/server/observability/logger';
import type {
  ExtractionRequest,
  GatewayResult,
  LlmGateway,
  UnavailableReason,
} from '@/server/pipeline/llm-gateway';

import { loadKeyPool } from '../config/key-pool';
import { callOutcome, classifyFailure, GatewayBugError } from './classify';
import { interactionsClientFor } from './client';
import {
  ASSUMED_DAILY_ALLOWANCE,
  exhaustionMemory,
  HOUR_MS,
  INSTANCE_DAILY_ACTIONS,
  MINUTE_MS,
  RESERVE_SHARE,
  type ExhaustionMemory,
} from './exhaustion';
import {
  buildInteractionRequest,
  callOptions,
  toGeminiSchema,
  type InteractionReply,
  type InteractionRequest,
  type InteractionsClient,
  type LadderModel,
  type RequestParts,
} from './interactions';
import { fromCache, readingCache, readingCacheKey, type ReadingCache } from './reading-cache';
import { validateReply } from './validate-reply';

/** D16: the whole read, every rung included, fits in 40 s (Cloud Run allows 60). */
export const ACTION_BUDGET_MS = 40_000;
/** FR-38: a call started with less than this left would likely be cut off and waste quota. */
export const MIN_CALL_START_MS = 6_000;

export interface Rung {
  readonly model: LadderModel;
  readonly timeoutMs: number;
  readonly minRemainingMs: number;
}

/** D16 ladder: the slower flash model is tried only when it has room to answer. */
export const LADDER: readonly Rung[] = [
  { model: 'gemini-3.5-flash-lite', timeoutMs: 20_000, minRemainingMs: MIN_CALL_START_MS },
  // It answers in about 5 s, but 12 s cut it off under load on 27 Oct. After a 20 s rung-1
  // timeout, 18 s still ends by 38 s, inside the budget, and rung 3 still needs 15 s left, so
  // the latest a read can end is unchanged.
  { model: 'gemini-3.1-flash-lite', timeoutMs: 18_000, minRemainingMs: MIN_CALL_START_MS },
  { model: 'gemini-3.5-flash', timeoutMs: ACTION_BUDGET_MS, minRemainingMs: 15_000 },
];

const RATE_LIMIT_COOL_MS = HOUR_MS;
const KEY_COOL_MS = 6 * HOUR_MS;
const RETIRED_COOL_MS = 6 * HOUR_MS;
const OVERLOAD_COOL_MS = 3 * MINUTE_MS;

export interface GatewayDeps {
  readonly keys: () => readonly string[];
  readonly clientFor: (apiKey: string) => InteractionsClient;
  readonly now: () => number;
  readonly memory: ExhaustionMemory;
  readonly cache: ReadingCache;
  /** Assumed calls per (model, key) per quota day (D17). */
  readonly allowance?: number;
  /** Model actions this instance may start per quota day (D18 b). */
  readonly dailyActionBudget?: number;
  /** Where each call's model, outcome and duration go; the process logger by default. */
  readonly log?: Logger;
}

type LadderOutcome =
  | {
      readonly kind: 'answer';
      readonly reply: InteractionReply;
      readonly requested: LadderModel;
    }
  | { readonly kind: 'none'; readonly reason: UnavailableReason };

// A request that cannot be shaped is our bug on every rung, so it becomes the error the read
// pipeline turns into the form, before any call or quota is counted, never a 500.
function shapedRequest(parts: RequestParts): InteractionRequest {
  try {
    return buildInteractionRequest(parts);
  } catch {
    throw new GatewayBugError('bad-request', 'the request could not be shaped');
  }
}

async function runLadder<T>(
  request: ExtractionRequest<T>,
  keys: readonly string[],
  deps: GatewayDeps,
  allowance: number,
): Promise<LadderOutcome> {
  const { memory, now } = deps;
  const logger = deps.log ?? log;
  const deadline = now() + ACTION_BUDGET_MS;
  const reserveLine = allowance * RESERVE_SHARE;
  const schema = toGeminiSchema(request.schema);
  let reason: UnavailableReason = 'quota';
  // An action is counted against the instance budget only once it spends a call.
  let calls = 0;

  for (const rung of LADDER) {
    if (deadline - now() < rung.minRemainingMs) {
      reason = 'timeout';
      continue;
    }
    if (memory.isModelCooled(rung.model, now())) {
      reason = 'timeout';
      continue;
    }
    for (const keyIndex of memory.keyOrder(rung.model, keys.length)) {
      const apiKey = keys[keyIndex];
      if (apiKey === undefined || memory.isPairBlocked(rung.model, keyIndex, now())) continue;
      // The last fifth of each pair is kept for typed text; examples have a recording.
      if (
        request.origin.kind === 'example' &&
        memory.callsToday(rung.model, keyIndex, now()) >= reserveLine
      ) {
        continue;
      }
      const remaining = deadline - now();
      if (remaining < MIN_CALL_START_MS) return { kind: 'none', reason: 'timeout' };

      const shaped = shapedRequest({
        model: rung.model,
        system: request.prompt.system,
        text: request.text,
        instruction: request.prompt.instruction(),
        schema,
      });
      if (calls === 0) memory.countAction(now());
      calls += 1;
      memory.countCall(rung.model, keyIndex, now());
      memory.markTried(rung.model, keyIndex);
      // Only the final outcome reaches the read's own log line, so each call is logged here to
      // show which rung failed and how. Never the key, its index, the text or the reply.
      const startedAt = now();
      try {
        const reply = await deps
          .clientFor(apiKey)
          .create(shaped, callOptions(Math.min(rung.timeoutMs, remaining)));
        logger.info('model-call', {
          model: rung.model,
          outcome: 'answer',
          durationMs: now() - startedAt,
        });
        return { kind: 'answer', reply, requested: rung.model };
      } catch (error: unknown) {
        const outcome = callOutcome(error);
        logger.warn('model-call', { model: rung.model, outcome, durationMs: now() - startedAt });
        const failure = classifyFailure(error);
        if (failure === 'our-bug') throw new GatewayBugError('bad-request', 'the API refused it');
        if (failure === 'rate-limit') {
          memory.coolPair(rung.model, keyIndex, RATE_LIMIT_COOL_MS, now());
          continue;
        }
        if (failure === 'auth') {
          memory.coolKey(keyIndex, KEY_COOL_MS, now());
          continue;
        }
        // A retired model is retired for every key, so one 404 spares the others a wasted call.
        if (failure === 'retired') {
          memory.coolModel(rung.model, RETIRED_COOL_MS, now());
        } else {
          reason = 'timeout';
          if (failure === 'overload') memory.coolModel(rung.model, OVERLOAD_COOL_MS, now());
        }
        break;
      }
    }
  }
  return { kind: 'none', reason };
}

/**
 * The ladder over models and keys (arch 5, D16). Order: cache, then the per-instance budget,
 * then live calls; an example text falls back to its recording rather than to the form.
 */
export function createGateway(deps: GatewayDeps): LlmGateway {
  return {
    async extract<T>(request: ExtractionRequest<T>): Promise<GatewayResult<T>> {
      const { cache, memory, now } = deps;
      const keys = deps.keys();
      const allowance = deps.allowance ?? ASSUMED_DAILY_ALLOWANCE;
      const budget = deps.dailyActionBudget ?? INSTANCE_DAILY_ACTIONS;
      const cacheKey = readingCacheKey({
        promptId: request.prompt.id,
        promptVersion: request.prompt.version,
        schemaVersion: request.schemaVersion,
        text: request.text,
        extra: request.cacheInputs ?? [],
      });
      const cached = fromCache(request, cache, cacheKey, now());
      if (cached !== undefined) return cached;

      // A keyless server says so even for an example text: a recording there would pass for
      // a working AI reader on a deploy that has none.
      if (keys.length === 0) return { kind: 'unavailable', reason: 'nokey' };
      const unavailable = (reason: UnavailableReason): GatewayResult<T> =>
        request.origin.kind === 'example'
          ? { kind: 'example', value: request.origin.recording }
          : { kind: 'unavailable', reason };
      if (memory.actionsToday(now()) >= budget) return unavailable('quota');

      const outcome = await runLadder(request, keys, deps, allowance);
      if (outcome.kind === 'none') return unavailable(outcome.reason);

      // A reply without a model id is reported as the model asked for, marked unconfirmed, because
      // the logger's allowlist drops anything that is not a gemini-* id.
      const answeredBy = outcome.reply.model ?? `${outcome.requested}-unconfirmed`;
      const value = validateReply(request.schema, outcome.reply.output_text ?? '');
      const refusal = request.check?.(value);
      if (refusal !== undefined) {
        cache.set(cacheKey, { kind: 'refused', reason: refusal, answeredBy }, now());
        return { kind: 'refused', source: 'ai', reason: refusal, answeredBy };
      }
      cache.set(cacheKey, { kind: 'reading', json: JSON.stringify(value), answeredBy }, now());
      return { kind: 'reading', source: 'ai', value, answeredBy };
    },
  };
}

/** The production wiring: keys read per call, one client per key, process-wide memory. */
export function defaultGateway(): LlmGateway {
  return createGateway({
    keys: () => loadKeyPool().keys,
    clientFor: interactionsClientFor,
    now: () => Date.now(),
    memory: exhaustionMemory(),
    cache: readingCache(),
  });
}
