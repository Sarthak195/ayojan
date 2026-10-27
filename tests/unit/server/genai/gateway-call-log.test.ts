import { describe, expect, it } from 'vitest';

import { createLogger } from '@/server/observability/logger';

import {
  answer,
  brief,
  failure,
  harness,
  KEYS,
  LITE,
  OLD_LITE,
  type Behaviour,
} from './ladder-harness';

// The brief and the reply both name the city, so either leaking shows up as this word.
const SECRET_CITY = 'Udaipur';

function captured() {
  const lines: string[] = [];
  return { lines, log: createLogger((line) => lines.push(line)) };
}

const parsed = (lines: readonly string[]): Record<string, unknown>[] =>
  lines.map((line) => JSON.parse(line) as Record<string, unknown>);

describe('the per-call log', () => {
  it('logs a timeout then an answer as two model-call events, in order', async () => {
    const { lines, log } = captured();
    const slowAnswer: Behaviour = {
      reply: { output_text: JSON.stringify({ city: SECRET_CITY }), model: OLD_LITE },
      latencyMs: 4_200,
    };
    const { gateway } = harness((model) => (model === LITE ? 'hang' : slowAnswer), { log });
    const result = await gateway.extract(brief(`200 guests in ${SECRET_CITY}`));
    expect(result).toMatchObject({ kind: 'reading' });
    expect(parsed(lines)).toEqual([
      {
        severity: 'WARNING',
        message: 'model-call',
        event: 'model-call',
        model: LITE,
        outcome: 'timeout',
        durationMs: 20_000,
      },
      {
        severity: 'INFO',
        message: 'model-call',
        event: 'model-call',
        model: OLD_LITE,
        outcome: 'answer',
        durationMs: 4_200,
      },
    ]);
  });

  it('tells an overload from a timeout and logs every call before a refused request throws', async () => {
    const { lines, log } = captured();
    const { gateway } = harness((model) => ({ error: failure(model === LITE ? 503 : 400) }), {
      log,
    });
    await expect(gateway.extract(brief())).rejects.toThrow();
    expect(parsed(lines).map((entry) => [entry.model, entry.outcome])).toEqual([
      [LITE, 'overload'],
      [OLD_LITE, 'error'],
    ]);
  });

  it('never writes the key, its index, the text, the prompt or the reply', async () => {
    const { lines, log } = captured();
    const { gateway } = harness(
      (_model, key) => (key === 0 ? { error: failure(429) } : answer(LITE, SECRET_CITY)),
      { log },
    );
    await gateway.extract(brief(`200 guests in ${SECRET_CITY}`));
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).not.toContain('dropped');
      expect(line).not.toContain(SECRET_CITY);
      expect(line).not.toContain('SYSTEM');
      expect(line).not.toContain('INSTRUCTION');
      expect(line).not.toContain('keyIndex');
      for (const key of KEYS) expect(line).not.toContain(key);
    }
    expect(parsed(lines).map((entry) => entry.outcome)).toEqual(['rate-limit', 'answer']);
  });
});
