import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/health/route';

const KEY_ONE = 'fake-key-one-9f3a';
const KEY_TWO = 'fake-key-two-71bc';

interface Body {
  status: string;
  keys: number;
  problems: string[];
}

async function callHealth(): Promise<{ response: Response; text: string; body: Body }> {
  const response = GET();
  const text = await response.clone().text();
  return { response, text, body: (await response.json()) as Body };
}

describe('GET /api/health', () => {
  beforeEach(() => {
    // A developer's real GEMINI_API_KEY_n variables must not leak into the assertions.
    for (const name of Object.keys(process.env)) {
      if (name.startsWith('GEMINI_API_KEY')) vi.stubEnv(name, '');
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('answers 503 with a problem message when no key is configured', async () => {
    const { response, body } = await callHealth();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unavailable');
    expect(body.keys).toBe(0);
    expect(body.problems).toHaveLength(1);
    expect(body.problems[0]).toContain('GEMINI_API_KEY');
  });

  it('answers 200 and counts the keys without returning any of them', async () => {
    vi.stubEnv('GEMINI_API_KEY', `${KEY_ONE}, ${KEY_ONE}`);
    vi.stubEnv('GEMINI_API_KEY_2', KEY_TWO);

    const { response, text, body } = await callHealth();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok', keys: 2, problems: [] });
    expect(text).not.toContain(KEY_ONE);
    expect(text).not.toContain(KEY_TWO);
  });

  it('is never cached', () => {
    vi.stubEnv('GEMINI_API_KEY', KEY_ONE);

    expect(GET().headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not call the network', () => {
    vi.stubEnv('GEMINI_API_KEY', KEY_ONE);

    // tests/setup.ts makes fetch throw, so reaching a model here would fail the call.
    expect(() => GET()).not.toThrow();
  });
});
