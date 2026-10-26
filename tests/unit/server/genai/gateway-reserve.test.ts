import { describe, expect, it } from 'vitest';

import { ASSUMED_DAILY_ALLOWANCE, RESERVE_SHARE } from '@/server/genai/exhaustion';

import { fakeLlmGateway, type FakeReply } from '../../../fakes/llm-gateway';
import {
  answer,
  brief,
  failure,
  harness,
  KEYS,
  LITE,
  MODELS,
  T0,
  type City,
  type Harness,
} from './ladder-harness';

const RECORDING: City = { city: 'Jaipur (recorded)' };
const example = brief('the sample brief', { origin: { kind: 'example', recording: RECORDING } });

function spend(h: Harness, callsPerPair: number): void {
  for (const model of MODELS) {
    for (let key = 0; key < KEYS.length; key += 1) {
      for (let call = 0; call < callsPerPair; call += 1) h.memory.countCall(model, key, T0);
    }
  }
}

describe('the reserve for typed text (D18)', () => {
  const reserveLine = ASSUMED_DAILY_ALLOWANCE * RESERVE_SHARE;

  it('serves an example text from its recording, with no call, above 80 percent', async () => {
    const h = harness(() => answer(LITE));
    spend(h, reserveLine);
    expect(await h.gateway.extract(example)).toEqual({ kind: 'example', value: RECORDING });
    expect(h.calls).toHaveLength(0);
    expect(h.memory.actionsToday(T0)).toBe(0);
  });

  it('still reads typed text live above 80 percent', async () => {
    const h = harness(() => answer(LITE));
    spend(h, reserveLine);
    expect(await h.gateway.extract(brief())).toMatchObject({ kind: 'reading', source: 'ai' });
    expect(h.calls).toHaveLength(1);
  });

  it('reads an example text live while its pair is below the line', async () => {
    const h = harness(() => answer(LITE));
    spend(h, reserveLine - 1);
    expect(await h.gateway.extract(example)).toMatchObject({ kind: 'reading', source: 'ai' });
  });

  it('falls back to the recording, not the form, when an example cannot be read live', async () => {
    const quota = harness(() => ({ error: failure(429) }));
    expect(await quota.gateway.extract(example)).toEqual({ kind: 'example', value: RECORDING });
    const timeout = harness(() => 'hang');
    expect(await timeout.gateway.extract(example)).toEqual({ kind: 'example', value: RECORDING });
  });

  it('says no key is set up even for an example text, so a keyless deploy looks keyless', async () => {
    const h = harness(() => answer(LITE), { keys: () => [] });
    expect(await h.gateway.extract(example)).toEqual({ kind: 'unavailable', reason: 'nokey' });
  });

  it('rejects, never throws synchronously, from the fake on a schema violation', async () => {
    const fake = fakeLlmGateway(new Map<string, FakeReply>([['brief', 'schema-violation']]));
    await expect(fake.extract(brief())).rejects.toMatchObject({ kind: 'schema-violation' });
  });

  it('counts each live call against its pair for the quota day', async () => {
    const h = harness(() => answer(LITE));
    await h.gateway.extract(brief());
    expect(h.memory.callsToday(LITE, 0, T0)).toBe(1);
    expect(h.memory.snapshot(T0)).toMatchObject({ actionsToday: 1 });
  });
});

describe('the reading cache in the gateway', () => {
  it('answers a repeated read from the cache with zero calls, labelled as cached', async () => {
    const h = harness(() => answer('gemini-3.5-flash-lite-002'));
    await h.gateway.extract(brief());
    expect(await h.gateway.extract(brief())).toEqual({
      kind: 'reading',
      source: 'ai-cached',
      value: { city: 'Jaipur' },
      answeredBy: 'gemini-3.5-flash-lite-002',
    });
    expect(h.calls).toHaveLength(1);
    expect(h.cache.stats(T0).entries).toBe(1);
  });

  it.each([
    ['the text', brief('201 guests in Jaipur')],
    ['the schema version', brief(undefined, { schemaVersion: '2' })],
    ['an extra input', brief(undefined, { cacheInputs: ['hi'] })],
    [
      'the prompt version',
      brief(undefined, {
        prompt: { id: 'brief', version: '2', system: 'SYSTEM', instruction: () => 'I' },
      }),
    ],
    [
      'the prompt id',
      brief(undefined, {
        prompt: { id: 'quote', version: '1', system: 'SYSTEM', instruction: () => 'I' },
      }),
    ],
  ])('reads again when %s changes', async (_name, changed) => {
    const h = harness(() => answer(LITE));
    await h.gateway.extract(brief());
    await h.gateway.extract(changed);
    expect(h.calls).toHaveLength(2);
  });

  it('caches a refusal from the caller check, so the same failing reply is not bought twice', async () => {
    const h = harness(() => answer(LITE));
    const checked = brief(undefined, { check: () => 'draft-check' });
    expect(await h.gateway.extract(checked)).toMatchObject({ kind: 'refused', source: 'ai' });
    expect(await h.gateway.extract(checked)).toEqual({
      kind: 'refused',
      source: 'ai-cached',
      reason: 'draft-check',
      answeredBy: LITE,
    });
    expect(h.calls).toHaveLength(1);
  });

  it('never caches an unavailable outcome', async () => {
    const h = harness(() => ({ error: failure(429) }));
    await h.gateway.extract(brief());
    expect(h.cache.stats(T0).entries).toBe(0);
  });
});

describe('the fake gateway', () => {
  it('routes on prompt identity, records calls and fails on request', async () => {
    const fake = fakeLlmGateway(
      new Map<string, FakeReply>([
        ['brief', { reading: { city: 'Udaipur' } }],
        ['quote', 'quota'],
      ]),
    );
    expect(await fake.extract(brief())).toMatchObject({ value: { city: 'Udaipur' } });
    const quote = brief('a quote', {
      prompt: { id: 'quote', version: '1', system: 'S', instruction: () => 'I' },
    });
    expect(await fake.extract(quote)).toEqual({ kind: 'unavailable', reason: 'quota' });
    expect(fake.calls.map((call) => call.promptId)).toEqual(['brief', 'quote']);
  });
});
