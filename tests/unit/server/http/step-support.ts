// Shared pieces for the plumbing tests: a fixed seal key, the real planning data, a pinned
// today, form requests, a limiter that can be told to refuse, and a logger that keeps lines.

import { join } from 'node:path';

import { parseIsoDate, type IsoDate } from '@/core/calendar/day-number';
import type { StateToken } from '@/schemas/plan/state-token';
import type { StepDeps } from '@/server/http/post-step';
import { createKnowledgeRepository, readFromDirectory } from '@/server/knowledge/repository';
import type { LogFields, Logger } from '@/server/observability/logger';
import type { RateDecision, RateLimiter } from '@/server/ratelimit/rate-limit';
import { encodeState } from '@/server/state/token-codec';
import type { PlanSources } from '@/server/view/plan-page';

import { BRIEF_OP } from '../../../fixtures/plan-readings';

export const SEAL_KEY = Buffer.alloc(32, 7);
export const OTHER_KEY = Buffer.alloc(32, 9);

const parsed = parseIsoDate('2026-10-31');
if (!parsed.ok) throw new Error('fixture date');
export const TODAY: IsoDate = parsed.value;

export const DATA = createKnowledgeRepository(readFromDirectory(join(process.cwd(), 'data'))).all();

export const BRIEF_STATE: StateToken = { schema: 1, ops: [BRIEF_OP] };

export function sources(key: Buffer = SEAL_KEY): PlanSources {
  return { sealKey: () => key, data: () => DATA, today: () => TODAY };
}

export function seal(state: StateToken, key: Buffer = SEAL_KEY): string {
  const encoded = encodeState(state, key);
  if (!encoded.ok) throw new Error(`fixture state refused: ${encoded.reason}`);
  return encoded.token;
}

export function formRequest(
  fields: Record<string, string>,
  contentType = 'application/x-www-form-urlencoded',
): Request {
  return new Request('http://localhost/en/task', {
    method: 'POST',
    headers: { 'content-type': contentType, 'x-forwarded-for': '203.0.113.9' },
    body: new URLSearchParams(fields).toString(),
  });
}

export function limiter(decision: RateDecision = { allowed: true }): RateLimiter & {
  readonly calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    check(rateClass) {
      calls.push(rateClass);
      return decision;
    },
  };
}

export interface KeptLine {
  readonly level: 'info' | 'warn' | 'error';
  readonly event: string;
  readonly fields: LogFields | undefined;
}

export function keepingLogger(): Logger & { readonly lines: KeptLine[] } {
  const lines: KeptLine[] = [];
  return {
    lines,
    info: (event, fields) => lines.push({ level: 'info', event, fields }),
    warn: (event, fields) => lines.push({ level: 'warn', event, fields }),
    error: (event, fields) => lines.push({ level: 'error', event, fields }),
  };
}

export function deps(overrides: Partial<StepDeps> = {}): StepDeps {
  return {
    ...sources(),
    limiter: limiter(),
    logger: keepingLogger(),
    now: () => 1_000,
    ...overrides,
  };
}

export const params = (lang: string): Promise<{ lang: string }> => Promise.resolve({ lang });
