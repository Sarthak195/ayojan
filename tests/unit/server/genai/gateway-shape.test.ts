import { describe, expect, it, vi } from 'vitest';

import { GatewayBugError } from '@/server/genai/classify';
import type * as Interactions from '@/server/genai/interactions';

import { answer, brief, harness, LITE, T0 } from './ladder-harness';

// A request that cannot be shaped is our bug: it must reach the read pipeline as the error it
// turns into the form, and no call or quota may be counted for a request never sent.
vi.mock('@/server/genai/interactions', async (importOriginal) => ({
  ...(await importOriginal<typeof Interactions>()),
  buildInteractionRequest: () => {
    throw new TypeError('cannot shape');
  },
}));

describe('a request that cannot be shaped', () => {
  it('throws a GatewayBugError before any call is made or counted', async () => {
    const { gateway, calls, memory } = harness(() => answer(LITE));
    await expect(gateway.extract(brief())).rejects.toBeInstanceOf(GatewayBugError);
    expect(calls).toEqual([]);
    expect(memory.callsToday(LITE, 0, T0)).toBe(0);
  });
});
