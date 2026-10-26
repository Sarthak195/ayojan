import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/health/route';
import { createExhaustionMemory } from '@/server/genai/exhaustion';
import { createReadingCache } from '@/server/genai/reading-cache';
import { createKnowledgeRepository, readFromDirectory } from '@/server/knowledge/repository';
import { healthReport, type HealthSources } from '@/server/observability/health';

const KEY_ONE = 'fake-key-one-9f3a';
const KEY_TWO = 'fake-key-two-71bc';
const SEAL_VALUE = Buffer.alloc(32, 3).toString('base64');
const NOW = Date.UTC(2026, 9, 31, 6, 0, 0);

const realData = createKnowledgeRepository(readFromDirectory(join(process.cwd(), 'data')));

function sources(overrides: Partial<HealthSources> = {}): HealthSources {
  return {
    env: { GEMINI_API_KEY: `${KEY_ONE}, ${KEY_TWO}`, STATE_SEAL_KEY: SEAL_VALUE },
    knowledge: realData,
    cache: createReadingCache(),
    exhaustion: createExhaustionMemory(),
    now: () => NOW,
    ...overrides,
  };
}

describe('healthReport', () => {
  it('is 200 with counts of data rows, cache entries, quota and keys', () => {
    const cache = createReadingCache();
    cache.set('k', { kind: 'reading', json: '{}', answeredBy: 'gemini-fake' }, NOW);
    const exhaustion = createExhaustionMemory();
    exhaustion.countCall('gemini-3.5-flash-lite', 1, NOW);
    const { httpStatus, report } = healthReport(sources({ cache, exhaustion }));
    expect(httpStatus).toBe(200);
    expect(report.status).toBe('ok');
    expect(report.ai).toBe('available');
    expect(report.keys).toBe(2);
    expect(report.sealKey).toBe('loaded');
    expect(report.data?.tasks).toBeGreaterThan(0);
    expect(report.data?.levers).toBeGreaterThan(0);
    expect(report.data?.questions).toBeGreaterThan(0);
    expect(report.readingCache.entries).toBe(1);
    expect(report.quota.callsToday).toEqual([
      { model: 'gemini-3.5-flash-lite', keyIndex: 1, calls: 1 },
    ]);
    expect(report.problems).toEqual([]);
  });

  it('is 200 with the AI off when no Gemini key is set', () => {
    const { httpStatus, report } = healthReport(
      sources({ env: { STATE_SEAL_KEY: SEAL_VALUE, NODE_ENV: 'production' } }),
    );
    expect(httpStatus).toBe(200);
    expect(report.ai).toBe('unavailable');
    expect(report.keys).toBe(0);
  });

  it('is 503 when production has no seal key, naming the variable', () => {
    const { httpStatus, report } = healthReport(
      sources({ env: { GEMINI_API_KEY: KEY_ONE, NODE_ENV: 'production' } }),
    );
    expect(httpStatus).toBe(503);
    expect(report.status).toBe('unavailable');
    expect(report.sealKey).toBe('missing');
    expect(report.problems.join(' ')).toContain('STATE_SEAL_KEY');
  });

  it('is 503 for a malformed seal key without echoing it', () => {
    const bad = 'not-a-32-byte-key';
    const { httpStatus, report } = healthReport(sources({ env: { STATE_SEAL_KEY: bad } }));
    expect(httpStatus).toBe(503);
    expect(report.sealKey).toBe('malformed');
    expect(JSON.stringify(report)).not.toContain(bad);
  });

  it('is 503 when the planning data cannot load, naming files only', () => {
    const broken = createKnowledgeRepository(() => 'tasks: [unclosed');
    const { httpStatus, report } = healthReport(sources({ knowledge: broken }));
    expect(httpStatus).toBe(503);
    expect(report.data).toBeNull();
    expect(report.problems[0]).toMatch(/^Planning data failed to load: data\/[a-z-]+\.yaml/);
    expect(report.problems[0]).not.toContain('unclosed');
  });

  it('is 503 without a path when a data file is missing', () => {
    const missing = createKnowledgeRepository(() => {
      throw new Error('ENOENT: /secret/path/tasks.yaml');
    });
    const { httpStatus, report } = healthReport(sources({ knowledge: missing }));
    expect(httpStatus).toBe(503);
    expect(report.problems).toEqual(['Planning data failed to load.']);
  });

  it('never carries a key value', () => {
    const text = JSON.stringify(healthReport(sources()).report);
    expect(text).not.toContain(KEY_ONE);
    expect(text).not.toContain(KEY_TWO);
    expect(text).not.toContain(SEAL_VALUE);
  });
});

describe('GET /api/health', () => {
  beforeEach(() => {
    // A developer's real key variables must not leak into the assertions.
    for (const name of Object.keys(process.env)) {
      if (name.startsWith('GEMINI_API_KEY')) vi.stubEnv(name, '');
    }
    vi.stubEnv('STATE_SEAL_KEY', SEAL_VALUE);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('answers 200 with counts and no key material', async () => {
    vi.stubEnv('GEMINI_API_KEY', `${KEY_ONE}, ${KEY_ONE}`);
    vi.stubEnv('GEMINI_API_KEY_2', KEY_TWO);
    const response = GET();
    const text = await response.text();
    expect(response.status).toBe(200);
    const body = JSON.parse(text) as { keys: number; ai: string; data: { tasks: number } };
    expect(body.keys).toBe(2);
    expect(body.ai).toBe('available');
    expect(body.data.tasks).toBeGreaterThan(0);
    for (const secret of [KEY_ONE, KEY_TWO, SEAL_VALUE]) expect(text).not.toContain(secret);
  });

  it('answers 200 with the AI off when no key is configured', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(((await response.json()) as { ai: string }).ai).toBe('unavailable');
  });

  it('answers 503 in production without a seal key', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STATE_SEAL_KEY', '');
    expect(GET().status).toBe(503);
  });

  it('is never cached and makes no network call', () => {
    // tests/setup.ts makes fetch throw, so reaching a model here would fail the call.
    expect(GET().headers.get('Cache-Control')).toBe('no-store');
  });
});
