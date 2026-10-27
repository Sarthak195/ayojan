import { describe, expect, it } from 'vitest';

import { quotaDayKey } from '@/server/config/clock';
import {
  createExhaustionMemory,
  exhaustionMemory,
  HOUR_MS,
  MINUTE_MS,
} from '@/server/genai/exhaustion';

const LITE = 'gemini-3.5-flash-lite';
const OLD_LITE = 'gemini-3.1-flash-lite';
const T0 = Date.UTC(2026, 9, 27, 3, 0); // 27 Oct 08:30 IST, 26 Oct 20:00 Pacific

describe('the quota day', () => {
  it.each([
    ['before midnight Pacific in daylight time', Date.UTC(2026, 9, 27, 6, 59), '2026-10-26'],
    ['at midnight Pacific in daylight time (12:30 IST)', Date.UTC(2026, 9, 27, 7, 0), '2026-10-27'],
    ['before midnight Pacific in standard time', Date.UTC(2026, 10, 3, 7, 59), '2026-11-02'],
    ['at midnight Pacific in standard time (13:30 IST)', Date.UTC(2026, 10, 3, 8, 0), '2026-11-03'],
  ])('resets %s, by the clock rule', (_name, nowMs, day) => {
    const memory = createExhaustionMemory();
    expect(memory.snapshot(nowMs).quotaDay).toBe(day);
    expect(quotaDayKey(() => nowMs)).toBe(day);
  });
});

describe('createExhaustionMemory', () => {
  it('cools a pair, a key for every model, and a model for every key, each until its end', () => {
    const memory = createExhaustionMemory();
    memory.coolPair(LITE, 0, HOUR_MS, T0);
    memory.coolKey(1, 6 * HOUR_MS, T0);
    memory.coolModel(OLD_LITE, 3 * MINUTE_MS, T0);

    expect(memory.isPairBlocked(LITE, 0, T0)).toBe(true);
    expect(memory.isPairBlocked(OLD_LITE, 0, T0)).toBe(false);
    expect(memory.isPairBlocked(OLD_LITE, 1, T0)).toBe(true);
    expect(memory.isModelCooled(OLD_LITE, T0 + 3 * MINUTE_MS - 1)).toBe(true);
    expect(memory.isModelCooled(OLD_LITE, T0 + 3 * MINUTE_MS)).toBe(false);
    expect(memory.isPairBlocked(LITE, 0, T0 + HOUR_MS)).toBe(false);
    expect(memory.isPairBlocked(LITE, 1, T0 + 6 * HOUR_MS)).toBe(false);
  });

  it('rotates the starting key after each tried key', () => {
    const memory = createExhaustionMemory();
    expect(memory.keyOrder(LITE, 3)).toEqual([0, 1, 2]);
    memory.markTried(LITE, 0);
    expect(memory.keyOrder(LITE, 3)).toEqual([1, 2, 0]);
    memory.markTried(LITE, 2);
    expect(memory.keyOrder(LITE, 3)).toEqual([0, 1, 2]);
    expect(memory.keyOrder(OLD_LITE, 3)).toEqual([0, 1, 2]);
    expect(memory.keyOrder(LITE, 0)).toEqual([]);
    // D46: one key is the deployed case, and it must stay first however often it is tried.
    expect(memory.keyOrder(LITE, 1)).toEqual([0]);
    memory.markTried(LITE, 0);
    expect(memory.keyOrder(LITE, 1)).toEqual([0]);
  });

  it('counts calls per pair and actions per quota day, and starts again at the reset', () => {
    const memory = createExhaustionMemory();
    memory.countCall(LITE, 0, T0);
    memory.countCall(LITE, 0, T0);
    memory.countCall(LITE, 1, T0);
    memory.countAction(T0);
    expect(memory.callsToday(LITE, 0, T0)).toBe(2);
    expect(memory.actionsToday(T0)).toBe(1);

    const nextDay = Date.UTC(2026, 9, 27, 7, 0);
    expect(memory.callsToday(LITE, 0, nextDay)).toBe(0);
    expect(memory.actionsToday(nextDay)).toBe(0);
  });

  it('reports counts and ids only for the health route', () => {
    const memory = createExhaustionMemory();
    memory.countCall(LITE, 2, T0);
    memory.countAction(T0);
    memory.coolPair(LITE, 2, HOUR_MS, T0);
    memory.coolKey(4, HOUR_MS, T0);
    memory.coolModel(OLD_LITE, MINUTE_MS, T0);
    memory.coolModel(LITE, MINUTE_MS, T0 - 2 * MINUTE_MS);

    expect(memory.snapshot(T0)).toEqual({
      quotaDay: '2026-10-26',
      actionsToday: 1,
      callsToday: [{ model: LITE, keyIndex: 2, calls: 1 }],
      cooledPairs: 1,
      cooledKeys: 1,
      cooledModels: [OLD_LITE],
    });
  });
});

describe('exhaustionMemory', () => {
  it('is one memory per process', () => {
    expect(exhaustionMemory()).toBe(exhaustionMemory());
  });
});
