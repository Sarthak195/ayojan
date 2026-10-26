import { describe, expect, it } from 'vitest';

import { GatewayBugError } from '@/server/genai/classify';
import { INSTANCE_DAILY_ACTIONS, LADDER_MODEL_COUNT } from '@/server/genai/exhaustion';
import { ACTION_BUDGET_MS, LADDER, MIN_CALL_START_MS } from '@/server/genai/gateway';

import {
  answer,
  brief,
  failure,
  FLASH,
  harness,
  LITE,
  MODELS,
  OLD_LITE,
  T0,
  tried,
  type Behaviour,
} from './ladder-harness';

describe('the ladder on a good day', () => {
  it('reads with rung 1, reports the answering model and shapes the request once', async () => {
    const { gateway, calls } = harness(() => answer('gemini-3.5-flash-lite-002'));
    const result = await gateway.extract(brief());
    expect(result).toEqual({
      kind: 'reading',
      source: 'ai',
      value: { city: 'Jaipur' },
      answeredBy: 'gemini-3.5-flash-lite-002',
    });
    expect(tried(calls)).toEqual([`${LITE}#0`]);
    expect(calls[0]?.timeoutMs).toBe(20_000);
    expect(calls[0]?.request.input).toContain('<user_text>\n200 guests in Jaipur\n</user_text>');
  });

  it('reports the model the server answered as, not the one requested', async () => {
    const { gateway } = harness((model) =>
      model === FLASH ? answer('gemini-3.6-flash') : { error: failure(503) },
    );
    const result = await gateway.extract(brief());
    expect(result).toMatchObject({ kind: 'reading', answeredBy: 'gemini-3.6-flash' });
  });

  it('starts the next action on the next key (round robin)', async () => {
    const { gateway, calls } = harness(() => answer(LITE));
    await gateway.extract(brief('first'));
    await gateway.extract(brief('second'));
    expect(tried(calls)).toEqual([`${LITE}#0`, `${LITE}#1`]);
  });
});

describe('a failed call', () => {
  it('429 cools that pair for an hour and tries the next key on the same model', async () => {
    const { gateway, calls, memory } = harness((_model, key) =>
      key === 0 ? { error: failure(429) } : answer(LITE),
    );
    expect(await gateway.extract(brief())).toMatchObject({ kind: 'reading' });
    expect(tried(calls)).toEqual([`${LITE}#0`, `${LITE}#1`]);
    expect(memory.isPairBlocked(LITE, 0, T0)).toBe(true);
    expect(memory.isPairBlocked(OLD_LITE, 0, T0)).toBe(false);
    expect(memory.isPairBlocked(LITE, 0, T0 + 60 * 60 * 1000)).toBe(false);
  });

  it.each([401, 403])('%i cools the key for every model and tries the next key', async (status) => {
    const { gateway, calls, memory } = harness((_model, key) =>
      key === 0 ? { error: failure(status) } : answer(LITE),
    );
    expect(await gateway.extract(brief())).toMatchObject({ kind: 'reading' });
    expect(tried(calls)).toEqual([`${LITE}#0`, `${LITE}#1`]);
    for (const model of MODELS) expect(memory.isPairBlocked(model, 0, T0)).toBe(true);
    expect(memory.isPairBlocked(LITE, 0, T0 + 6 * 60 * 60 * 1000)).toBe(false);
  });

  it('404 remembers the retired pair for six hours and moves to the next model', async () => {
    const { gateway, calls, memory } = harness((model) =>
      model === LITE ? { error: failure(404) } : answer(OLD_LITE),
    );
    expect(await gateway.extract(brief())).toMatchObject({ kind: 'reading' });
    expect(tried(calls)).toEqual([`${LITE}#0`, `${OLD_LITE}#0`]);
    expect(memory.isPairBlocked(LITE, 0, T0 + 6 * 60 * 60 * 1000 - 1)).toBe(true);
  });

  const timeoutLike = (name: string, message: string, extra: object = {}): Error =>
    Object.assign(new Error(message), { name }, extra);

  it.each<[string, Error]>([
    ['a 500', failure(500)],
    ['a 503', failure(503)],
    ['a 408', failure(408)],
    ['an SDK client timeout', timeoutLike('APIConnectionTimeoutError', 'Request timed out.')],
    ['an AbortSignal timeout', timeoutLike('TimeoutError', 'The operation was aborted')],
    ['an abort', timeoutLike('AbortError', 'This operation was aborted')],
    [
      'an undici timeout inside the cause',
      timeoutLike('TypeError', 'fetch failed', {
        cause: Object.assign(new Error('Headers'), { code: 'UND_ERR_HEADERS_TIMEOUT' }),
      }),
    ],
  ])('%s cools the model on every key and moves to the next model', async (_name, error) => {
    const { gateway, calls, memory } = harness((model) =>
      model === LITE ? { error } : answer(OLD_LITE),
    );
    expect(await gateway.extract(brief('first'))).toMatchObject({ kind: 'reading' });
    expect(tried(calls)).toEqual([`${LITE}#0`, `${OLD_LITE}#0`]);
    expect(memory.isModelCooled(LITE, T0)).toBe(true);

    await gateway.extract(brief('second'));
    expect(tried(calls).slice(2)).toEqual([`${OLD_LITE}#1`]);
  });

  it('skips a model whose overload is remembered, on every key', async () => {
    const { gateway, calls, memory } = harness(() => answer(OLD_LITE));
    memory.coolModel(LITE, 3 * 60 * 1000, T0);
    await gateway.extract(brief());
    expect(calls.map((call) => call.model)).toEqual([OLD_LITE]);
  });

  it.each([400, 422])(
    '%i throws at once: it is our bug and would fail everywhere',
    async (status) => {
      const { gateway, calls } = harness(() => ({ error: failure(status) }));
      await expect(gateway.extract(brief())).rejects.toBeInstanceOf(GatewayBugError);
      expect(calls).toHaveLength(1);
    },
  );

  it.each([
    ['text that is not JSON', 'Sure! Here is the city: Jaipur'],
    ['JSON that breaks the schema', '{"town":"secret-reply-text"}'],
  ])('a reply with %s throws a schema violation without echoing it', async (_name, text) => {
    const { gateway, calls } = harness(() => ({ reply: { output_text: text, model: LITE } }));
    const thrown = await gateway.extract(brief()).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(GatewayBugError);
    expect(thrown).toMatchObject({ kind: 'schema-violation' });
    expect(String(thrown)).not.toContain('secret-reply-text');
    expect(String(thrown)).not.toContain('Jaipur');
    expect(calls).toHaveLength(1);
  });
});

describe('the 40 s budget (D16)', () => {
  const elapsed = (clock: { now: () => number }): number => clock.now() - T0;

  it('gives rung 1 20 s and rung 2 12 s, then skips rung 3 with only 8 s left', async () => {
    const { gateway, calls, clock } = harness(() => 'hang');
    const result = await gateway.extract(brief());
    expect(result).toEqual({ kind: 'unavailable', reason: 'timeout' });
    expect(calls.map((call) => [call.model, call.timeoutMs])).toEqual([
      [LITE, 20_000],
      [OLD_LITE, 12_000],
    ]);
    expect(elapsed(clock)).toBe(32_000);
  });

  it('enters rung 3 with at least 15 s left and caps its timeout at the time left', async () => {
    const slowFailure: Behaviour = { error: failure(503), latencyMs: 9_000 };
    const { gateway, calls, clock } = harness((model) => (model === FLASH ? 'hang' : slowFailure));
    await gateway.extract(brief());
    expect(calls.map((call) => [call.model, call.timeoutMs])).toEqual([
      [LITE, 20_000],
      [OLD_LITE, 12_000],
      [FLASH, 22_000],
    ]);
    expect(elapsed(clock)).toBe(ACTION_BUDGET_MS);
  });

  it('never starts a call with under 6 s left and never runs past 40 s', async () => {
    const slow429: Behaviour = { error: failure(429), latencyMs: 9_000 };
    const { gateway, calls, clock } = harness(() => slow429);
    const result = await gateway.extract(brief());
    expect(result).toEqual({ kind: 'unavailable', reason: 'timeout' });
    for (const call of calls) {
      expect(ACTION_BUDGET_MS - (call.startedAt - T0)).toBeGreaterThanOrEqual(MIN_CALL_START_MS);
      expect(call.startedAt - T0 + call.timeoutMs).toBeLessThanOrEqual(ACTION_BUDGET_MS);
    }
    expect(elapsed(clock)).toBeLessThanOrEqual(ACTION_BUDGET_MS);
  });
});

describe('when nothing answers', () => {
  it('tries each (model, key) pair at most once and names the quota as the reason', async () => {
    const { gateway, calls } = harness(() => ({ error: failure(429) }));
    expect(await gateway.extract(brief())).toEqual({ kind: 'unavailable', reason: 'quota' });
    expect(new Set(tried(calls)).size).toBe(calls.length);
    expect(calls).toHaveLength(9);
  });

  it('says no key is set up when the pool is empty, without a call', async () => {
    const { gateway, calls } = harness(() => answer(LITE), { keys: () => [] });
    expect(await gateway.extract(brief())).toEqual({ kind: 'unavailable', reason: 'nokey' });
    expect(calls).toHaveLength(0);
  });

  it('stops at the per-instance daily action budget', async () => {
    const { gateway, calls } = harness(() => answer(LITE), { dailyActionBudget: 1 });
    await gateway.extract(brief('first'));
    expect(await gateway.extract(brief('second'))).toEqual({
      kind: 'unavailable',
      reason: 'quota',
    });
    expect(calls).toHaveLength(1);
  });

  it('defaults to the one shared instance budget, derived from the D17 working value', async () => {
    expect(INSTANCE_DAILY_ACTIONS).toBe(120);
    expect(LADDER).toHaveLength(LADDER_MODEL_COUNT);

    const { gateway, memory } = harness(() => answer(LITE));
    for (let spent = 0; spent < INSTANCE_DAILY_ACTIONS - 1; spent += 1) memory.countAction(T0);
    expect(await gateway.extract(brief('last one'))).toMatchObject({ kind: 'reading' });
    expect(await gateway.extract(brief('one too many'))).toEqual({
      kind: 'unavailable',
      reason: 'quota',
    });
  });
});
