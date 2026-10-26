import { z } from 'zod';

import { createExhaustionMemory, type ExhaustionMemory } from '@/server/genai/exhaustion';
import { createGateway, type GatewayDeps } from '@/server/genai/gateway';
import type {
  InteractionReply,
  InteractionRequest,
  InteractionsClient,
  LadderModel,
} from '@/server/genai/interactions';
import { createReadingCache, type ReadingCache } from '@/server/genai/reading-cache';
import type { ExtractionRequest, LlmGateway } from '@/server/pipeline/llm-gateway';

export const LITE: LadderModel = 'gemini-3.5-flash-lite';
export const OLD_LITE: LadderModel = 'gemini-3.1-flash-lite';
export const FLASH: LadderModel = 'gemini-3.5-flash';
export const MODELS = [LITE, OLD_LITE, FLASH] as const;
export const KEYS = ['fake-key-0', 'fake-key-1', 'fake-key-2'] as const;
export const T0 = Date.UTC(2026, 9, 27, 3, 0);

export const CitySchema = z.object({ city: z.string() });
export type City = z.infer<typeof CitySchema>;

/** What one fake call does: answer or fail, after the given latency on the fake clock. */
export type Behaviour =
  | { readonly reply: InteractionReply; readonly latencyMs?: number }
  | { readonly error: Error; readonly latencyMs?: number }
  | 'hang';

export interface Call {
  readonly model: LadderModel;
  readonly keyIndex: number;
  readonly timeoutMs: number;
  readonly startedAt: number;
  readonly request: InteractionRequest;
}

export const answer = (model: string, city = 'Jaipur'): Behaviour => ({
  reply: { output_text: JSON.stringify({ city }), model },
});

export const failure = (status: number | undefined, extra: object = {}): Error =>
  Object.assign(new Error(`fake failure ${String(status)}`), { status }, extra);

export interface Harness {
  readonly gateway: LlmGateway;
  readonly calls: Call[];
  readonly memory: ExhaustionMemory;
  readonly cache: ReadingCache;
  readonly clock: { now: () => number };
}

/**
 * A fake client per key over a fake clock. A hanging call moves the clock by the whole
 * timeout it was given and then fails the way the SDK does, so no test waits on a real timer.
 */
export function harness(
  behave: (model: LadderModel, keyIndex: number) => Behaviour,
  overrides: Partial<GatewayDeps> = {},
): Harness {
  let nowMs = T0;
  const calls: Call[] = [];
  const memory = createExhaustionMemory();
  const cache = createReadingCache();
  const clientFor = (apiKey: string): InteractionsClient => ({
    create(request, options) {
      const keyIndex = KEYS.findIndex((key) => key === apiKey);
      const startedAt = nowMs;
      calls.push({
        model: request.model,
        keyIndex,
        timeoutMs: options.timeout_ms,
        startedAt,
        request,
      });
      const behaviour = behave(request.model, keyIndex);
      if (behaviour === 'hang') {
        nowMs += options.timeout_ms;
        const timeout = new Error('Request timed out: TimeoutError: The operation was aborted');
        timeout.name = 'APIConnectionTimeoutError';
        return Promise.reject(timeout);
      }
      nowMs += Math.min(behaviour.latencyMs ?? 0, options.timeout_ms);
      return 'reply' in behaviour
        ? Promise.resolve(behaviour.reply)
        : Promise.reject(behaviour.error);
    },
  });
  const clock = { now: () => nowMs };
  const gateway = createGateway({
    keys: () => KEYS,
    clientFor,
    now: clock.now,
    memory,
    cache,
    ...overrides,
  });
  return { gateway, calls, memory, cache, clock };
}

export function brief(
  text = '200 guests in Jaipur',
  extra: Partial<ExtractionRequest<City>> = {},
): ExtractionRequest<City> {
  return {
    prompt: { id: 'brief', version: 1, system: 'SYSTEM', instruction: () => 'INSTRUCTION' },
    schema: CitySchema,
    schemaVersion: '1',
    text,
    origin: { kind: 'typed' },
    ...extra,
  };
}

export const tried = (calls: readonly Call[]): string[] =>
  calls.map((call) => `${call.model}#${String(call.keyIndex)}`);
