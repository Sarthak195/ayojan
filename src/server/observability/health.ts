import 'server-only';

import { loadKeyPool } from '../config/key-pool';
import { systemNow, type Now } from '../config/clock';
import {
  exhaustionMemory,
  type ExhaustionMemory,
  type ExhaustionSnapshot,
} from '../genai/exhaustion';
import { readingCache, type CacheStats, type ReadingCache } from '../genai/reading-cache';
import { DataFileError } from '../knowledge/data-problem';
import { knowledge, type KnowledgeRepository } from '../knowledge/repository';
import { loadSealKey, SealKeyError } from '../state/seal-key';

// Counts only (FR-45). No model call: a probe must not spend quota. No key material: the key
// pool contributes its size, the quota snapshot names keys by index, and a seal key failure
// is reported by its named error, whose message never quotes the value. The public answer is
// only what an operator needs from outside; the key count, today's action count and the per-key
// and per-model counters and cool-downs would tell a stranger how much capacity is left, so they appear
// only when HEALTH_DETAIL=1 is set on the server.

type Environment = Readonly<Record<string, string | undefined>>;

export interface DataCounts {
  readonly tasks: number;
  readonly levers: number;
  readonly questions: number;
}

export interface HealthReport {
  readonly status: 'ok' | 'unavailable';
  /** The form twin works without a key, so a keyless server is healthy with the AI off. */
  readonly ai: 'available' | 'unavailable';
  readonly sealKey: 'loaded' | 'missing' | 'malformed';
  readonly data: DataCounts | null;
  /** Entries only: enough for an operator to see whether the cache is warm; the size is under detail. */
  readonly readingCache: { readonly entries: number };
  readonly problems: readonly string[];
  /** Present only when HEALTH_DETAIL=1. */
  readonly detail?: HealthDetail;
}

export interface HealthDetail {
  readonly keys: number;
  readonly readingCache: CacheStats;
  readonly quota: ExhaustionSnapshot;
}

export interface HealthSources {
  readonly env: Environment;
  readonly knowledge: KnowledgeRepository;
  readonly cache: ReadingCache;
  readonly exhaustion: ExhaustionMemory;
  readonly now: Now;
}

export function defaultHealthSources(): HealthSources {
  return {
    env: process.env,
    knowledge: knowledge(),
    cache: readingCache(),
    exhaustion: exhaustionMemory(),
    now: systemNow,
  };
}

function sealKeyState(env: Environment): {
  state: HealthReport['sealKey'];
  problem: string | null;
} {
  try {
    loadSealKey(env);
    return { state: 'loaded', problem: null };
  } catch (error) {
    if (!(error instanceof SealKeyError)) throw error;
    const missing = (env.STATE_SEAL_KEY?.trim() ?? '') === '';
    return { state: missing ? 'missing' : 'malformed', problem: error.message };
  }
}

function dataState(repository: KnowledgeRepository): {
  counts: DataCounts | null;
  problem: string | null;
} {
  try {
    const documents = repository.all();
    return {
      counts: {
        tasks: documents.tasks.tasks.length,
        levers: documents.levers.levers.length,
        questions: documents.vendorQuestions.questions.length,
      },
      problem: null,
    };
  } catch (error) {
    // File names only: the row detail is for the person fixing the YAML, in the build log. Any
    // other failure (a missing file) is reported without its message, which holds a path.
    if (!(error instanceof DataFileError)) {
      return { counts: null, problem: 'Planning data failed to load.' };
    }
    const files = [...new Set(error.problems.map((problem) => `data/${problem.fileName}`))];
    return { counts: null, problem: `Planning data failed to load: ${files.join(', ')}.` };
  }
}

/** The report and its status: 503 when the seal key or the planning data cannot load. */
export function healthReport(sources: HealthSources = defaultHealthSources()): {
  readonly httpStatus: 200 | 503;
  readonly report: HealthReport;
} {
  const nowMs = sources.now();
  const keys = loadKeyPool(sources.env).count;
  const seal = sealKeyState(sources.env);
  const data = dataState(sources.knowledge);
  const problems = [seal.problem, data.problem].filter((problem) => problem !== null);
  const healthy = problems.length === 0;
  const cache = sources.cache.stats(nowMs);
  const quota = sources.exhaustion.snapshot(nowMs);
  return {
    httpStatus: healthy ? 200 : 503,
    report: {
      status: healthy ? 'ok' : 'unavailable',
      ai: keys > 0 ? 'available' : 'unavailable',
      sealKey: seal.state,
      data: data.counts,
      readingCache: { entries: cache.entries },
      problems,
      ...(sources.env.HEALTH_DETAIL === '1'
        ? { detail: { keys, readingCache: cache, quota } }
        : {}),
    },
  };
}
