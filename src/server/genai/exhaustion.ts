import 'server-only';

import { quotaDayKey } from '../config/clock';
import type { LadderModel } from './interactions';

/** D17 working value: about 20 requests a day per model per project, one project per key. */
export const ASSUMED_DAILY_ALLOWANCE = 20;
/**
 * D46: the service runs on one key from one project, since pooling free-tier keys across
 * projects can read as getting around Google's usage limits. The pool and rotation still work
 * with several keys; only the budget assumes one project.
 */
export const ASSUMED_PROJECTS = 1;
/** The models on the ladder (D16), each with its own allowance per project. */
export const LADDER_MODEL_COUNT = 3;
/** D46: Cloud Run runs one instance, so one set of counters owns the whole daily budget. */
export const ASSUMED_MAX_INSTANCES = 1;
/**
 * D18 b: the one per-instance daily model-action budget, an instance's share of the assumed
 * allowance (1 x 3 x 20 = 60 calls a day, on 1 instance). The rate limiter refuses at the door
 * with it and the gateway stops starting ladders with it, so the two can never disagree.
 */
export const INSTANCE_DAILY_ACTIONS = Math.ceil(
  (ASSUMED_PROJECTS * LADDER_MODEL_COUNT * ASSUMED_DAILY_ALLOWANCE) / ASSUMED_MAX_INSTANCES,
);
/** D18: above this share of a pair's allowance, example texts stop spending live calls. */
export const RESERVE_SHARE = 0.8;

export const HOUR_MS = 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;

export interface PairCalls {
  readonly model: LadderModel;
  readonly keyIndex: number;
  readonly calls: number;
}

/** Counts and ids only: this is what /api/health shows, so it never holds a key or any text. */
export interface ExhaustionSnapshot {
  readonly quotaDay: string;
  readonly actionsToday: number;
  readonly callsToday: readonly PairCalls[];
  readonly cooledPairs: number;
  readonly cooledKeys: number;
  readonly cooledModels: readonly LadderModel[];
}

export interface ExhaustionMemory {
  isModelCooled(model: LadderModel, nowMs: number): boolean;
  /** True when the pair is cooled, or its key is cooled for every model. */
  isPairBlocked(model: LadderModel, keyIndex: number, nowMs: number): boolean;
  coolModel(model: LadderModel, forMs: number, nowMs: number): void;
  coolPair(model: LadderModel, keyIndex: number, forMs: number, nowMs: number): void;
  coolKey(keyIndex: number, forMs: number, nowMs: number): void;
  /** Key indexes for this model, starting after the key the previous action used last. */
  keyOrder(model: LadderModel, keyCount: number): readonly number[];
  markTried(model: LadderModel, keyIndex: number): void;
  countCall(model: LadderModel, keyIndex: number, nowMs: number): void;
  callsToday(model: LadderModel, keyIndex: number, nowMs: number): number;
  countAction(nowMs: number): void;
  actionsToday(nowMs: number): number;
  snapshot(nowMs: number): ExhaustionSnapshot;
}

const pairId = (model: LadderModel, keyIndex: number): string => `${model}|${String(keyIndex)}`;

function stillCooling<K>(until: Map<K, number>, id: K, nowMs: number): boolean {
  const end = until.get(id);
  if (end === undefined) return false;
  if (end > nowMs) return true;
  until.delete(id);
  return false;
}

function countCooling<K>(until: Map<K, number>, nowMs: number): K[] {
  return [...until.entries()].filter(([, end]) => end > nowMs).map(([id]) => id);
}

/**
 * Remembered by key index in pool order, never by the key itself, so nothing secret can leak
 * through the health snapshot. Counters keep only the current quota day: a new day drops the
 * old one, which keeps the maps bounded by models x keys.
 */
export function createExhaustionMemory(): ExhaustionMemory {
  const modelUntil = new Map<LadderModel, number>();
  const pairUntil = new Map<string, number>();
  const keyUntil = new Map<number, number>();
  const nextKey = new Map<LadderModel, number>();
  const calls = new Map<string, PairCalls>();
  let day = '';
  let actions = 0;

  function rollDay(nowMs: number): void {
    // The one Pacific quota-day rule is the clock's (D17), so counters and daily caps roll together.
    const today = quotaDayKey(() => nowMs);
    if (today === day) return;
    day = today;
    actions = 0;
    calls.clear();
  }

  return {
    isModelCooled: (model, nowMs) => stillCooling(modelUntil, model, nowMs),
    isPairBlocked: (model, keyIndex, nowMs) =>
      stillCooling(keyUntil, keyIndex, nowMs) ||
      stillCooling(pairUntil, pairId(model, keyIndex), nowMs),
    coolModel(model, forMs, nowMs) {
      modelUntil.set(model, nowMs + forMs);
    },
    coolPair(model, keyIndex, forMs, nowMs) {
      pairUntil.set(pairId(model, keyIndex), nowMs + forMs);
    },
    coolKey(keyIndex, forMs, nowMs) {
      keyUntil.set(keyIndex, nowMs + forMs);
    },
    keyOrder(model, keyCount) {
      const start = (nextKey.get(model) ?? 0) % Math.max(keyCount, 1);
      return Array.from({ length: keyCount }, (_, offset) => (start + offset) % keyCount);
    },
    markTried(model, keyIndex) {
      nextKey.set(model, keyIndex + 1);
    },
    countCall(model, keyIndex, nowMs) {
      rollDay(nowMs);
      const id = pairId(model, keyIndex);
      calls.set(id, { model, keyIndex, calls: (calls.get(id)?.calls ?? 0) + 1 });
    },
    callsToday(model, keyIndex, nowMs) {
      rollDay(nowMs);
      return calls.get(pairId(model, keyIndex))?.calls ?? 0;
    },
    countAction(nowMs) {
      rollDay(nowMs);
      actions += 1;
    },
    actionsToday(nowMs) {
      rollDay(nowMs);
      return actions;
    },
    snapshot(nowMs) {
      rollDay(nowMs);
      return {
        quotaDay: day,
        actionsToday: actions,
        callsToday: [...calls.values()],
        cooledPairs: countCooling(pairUntil, nowMs).length,
        cooledKeys: countCooling(keyUntil, nowMs).length,
        cooledModels: countCooling(modelUntil, nowMs),
      };
    },
  };
}

const HOLDER = Symbol.for('ayojan.exhaustion');
type ExhaustionHolder = typeof globalThis & { [HOLDER]?: ExhaustionMemory };

/** One memory per process, on globalThis because each Next route is bundled separately. */
export function exhaustionMemory(): ExhaustionMemory {
  const holder: ExhaustionHolder = globalThis;
  const held = holder[HOLDER] ?? createExhaustionMemory();
  holder[HOLDER] = held;
  return held;
}
