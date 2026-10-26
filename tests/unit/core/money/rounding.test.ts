import { describe, expect, it } from 'vitest';

import type { MoneyRefusal } from '@/core/money/money';
import type { RoundingUnit } from '@/core/money/rounding';
import { roundForBudget, roundToUnit, roundingUnit } from '@/core/money/rounding';

describe('roundingUnit (D15: Rs 100 below Rs 1 lakh, else Rs 1,000)', () => {
  it.each<[string, number, RoundingUnit]>([
    ['zero budget', 0, 100],
    ['the Rs 5,000 floor', 5_000, 100],
    ['a Rs 10,000 birthday', 10_000, 100],
    ['one rupee below a lakh', 99_999, 100],
    ['exactly a lakh', 100_000, 1000],
    ['one rupee above a lakh', 100_001, 1000],
    ['8 lakh', 800_000, 1000],
    ['the Rs 10 crore ceiling', 100_000_000, 1000],
  ])('%s gives a unit of Rs %i', (_name, budget, unit) => {
    expect(roundingUnit(budget)).toEqual({ ok: true, value: unit });
  });

  it.each<[string, number, MoneyRefusal]>([
    ['a negative budget', -1, 'out-of-range'],
    ['a fractional budget', 5000.5, 'not-whole-rupees'],
    ['NaN', Number.NaN, 'not-a-number'],
    ['Infinity', Number.POSITIVE_INFINITY, 'out-of-range'],
  ])('refuses %s', (_name, budget, reason) => {
    expect(roundingUnit(budget)).toEqual({ ok: false, reason });
  });
});

describe('roundToUnit (half up)', () => {
  it.each<[string, number, RoundingUnit, number]>([
    ['zero stays zero at Rs 100', 0, 100, 0],
    ['zero stays zero at Rs 1,000', 0, 1000, 0],
    ['an exact multiple is unchanged', 166_000, 1000, 166_000],
    ['just below half rounds down at Rs 1,000', 1_499, 1000, 1_000],
    ['exactly half rounds up at Rs 1,000', 1_500, 1000, 2_000],
    ['just below half rounds down at Rs 100', 149, 100, 100],
    ['exactly half rounds up at Rs 100', 150, 100, 200],
    ['below half a step rounds to zero', 49, 100, 0],
    ['one rupee rounds to zero', 1, 1000, 0],
    ['an uneven share rounds to the nearest thousand', 165_991, 1000, 166_000],
  ])('%s', (_name, amount, unit, expected) => {
    expect(roundToUnit(amount, unit)).toEqual({ ok: true, value: expected });
  });

  it.each<[string, number, MoneyRefusal]>([
    ['a negative amount', -100, 'out-of-range'],
    ['a fractional amount', 150.5, 'not-whole-rupees'],
    ['NaN', Number.NaN, 'not-a-number'],
    ['an amount above the safe limit', Number.MAX_SAFE_INTEGER + 1, 'out-of-range'],
  ])('refuses %s', (_name, amount, reason) => {
    expect(roundToUnit(amount, 1000)).toEqual({ ok: false, reason });
  });

  it('refuses when rounding up would leave the safe range', () => {
    expect(roundToUnit(Number.MAX_SAFE_INTEGER, 1000)).toEqual({
      ok: false,
      reason: 'out-of-range',
    });
  });
});

describe('roundForBudget', () => {
  it('uses Rs 100 for a Rs 10,000 celebration', () => {
    expect(roundForBudget(1_249, 10_000)).toEqual({ ok: true, value: 1_200 });
    expect(roundForBudget(1_250, 10_000)).toEqual({ ok: true, value: 1_300 });
  });

  it('uses Rs 1,000 at exactly one lakh', () => {
    expect(roundForBudget(1_499, 100_000)).toEqual({ ok: true, value: 1_000 });
    expect(roundForBudget(1_500, 100_000)).toEqual({ ok: true, value: 2_000 });
  });

  it('passes a budget refusal through', () => {
    expect(roundForBudget(1_000, -5)).toEqual({ ok: false, reason: 'out-of-range' });
  });

  it('passes an amount refusal through', () => {
    expect(roundForBudget(-1_000, 800_000)).toEqual({ ok: false, reason: 'out-of-range' });
  });
});
