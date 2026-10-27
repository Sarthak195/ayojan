import { describe, expect, it } from 'vitest';

import { answer, brief, failure, harness, LITE, OLD_LITE, tried } from './ladder-harness';

// D46: the deployed service has exactly one key, so a rejected key has nothing to fall back on.
const oneKey = { keys: () => ['fake-key-0'] };

describe('the ladder with exactly one key', () => {
  it('stops after one call on a 401, because the cooled key is skipped on every later rung', async () => {
    const { gateway, calls } = harness(() => ({ error: failure(401) }), oneKey);
    const result = await gateway.extract(brief());
    expect(result.kind).toBe('unavailable');
    expect(tried(calls)).toEqual([`${LITE}#0`]);
  });

  it('sends a 429 on the first model to the next model on the same key', async () => {
    const { gateway, calls } = harness(
      (model) => (model === LITE ? { error: failure(429) } : answer(OLD_LITE)),
      oneKey,
    );
    const result = await gateway.extract(brief());
    expect(result).toMatchObject({ kind: 'reading', answeredBy: OLD_LITE });
    expect(tried(calls)).toEqual([`${LITE}#0`, `${OLD_LITE}#0`]);
  });
});
