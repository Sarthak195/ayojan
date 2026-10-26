import { describe, expect, it } from 'vitest';

import type { Money, MoneyRefusal, Provenance } from '@/core/money/money';
import { difference, divideRoundHalfUp, money, scale, sum } from '@/core/money/money';

function amount(inr: number, provenance: Provenance = 'your-number'): Money {
  return { inr, provenance };
}

describe('money construction', () => {
  it.each([
    ['zero', 0],
    ['one rupee', 1],
    ['a typical budget', 800_000],
    ['the largest safe integer', Number.MAX_SAFE_INTEGER],
    ['a negative gap (over budget)', -120_000],
  ])('accepts %s as whole rupees', (_name, inr) => {
    expect(money(inr, 'computed')).toEqual({ ok: true, value: { inr, provenance: 'computed' } });
  });

  it.each<[string, number, MoneyRefusal]>([
    ['NaN', Number.NaN, 'not-a-number'],
    ['Infinity', Number.POSITIVE_INFINITY, 'out-of-range'],
    ['negative Infinity', Number.NEGATIVE_INFINITY, 'out-of-range'],
    ['a fraction of a rupee', 12.5, 'not-whole-rupees'],
    ['one above the safe integer limit', Number.MAX_SAFE_INTEGER + 1, 'out-of-range'],
  ])('refuses %s with a typed reason, without throwing', (_name, inr, reason) => {
    expect(money(inr, 'your-number')).toEqual({ ok: false, reason });
  });

  it('keeps the provenance it was given', () => {
    const provenances: Provenance[] = [
      'your-number',
      'your-split',
      'from-quote',
      'computed',
      'assumption',
    ];
    for (const provenance of provenances) {
      expect(money(10, provenance)).toEqual({ ok: true, value: { inr: 10, provenance } });
    }
  });
});

describe('sum', () => {
  it('is computed when provenances are mixed', () => {
    const total = sum([
      amount(100, 'your-number'),
      amount(250, 'from-quote'),
      amount(50, 'assumption'),
    ]);
    expect(total).toEqual({ ok: true, value: { inr: 400, provenance: 'computed' } });
  });

  it('is computed even when every input shares one provenance', () => {
    const total = sum([amount(100, 'your-split'), amount(200, 'your-split')]);
    expect(total).toEqual({ ok: true, value: { inr: 300, provenance: 'computed' } });
  });

  it('is zero for no amounts', () => {
    expect(sum([])).toEqual({ ok: true, value: { inr: 0, provenance: 'computed' } });
  });

  it('adds negative amounts', () => {
    expect(sum([amount(500), amount(-800)])).toEqual({
      ok: true,
      value: { inr: -300, provenance: 'computed' },
    });
  });

  it('refuses when the running total leaves the safe range even if a later term would pull it back', () => {
    const result = sum([amount(Number.MAX_SAFE_INTEGER), amount(10), amount(-20)]);
    expect(result).toEqual({ ok: false, reason: 'out-of-range' });
  });
});

describe('difference', () => {
  it('subtracts and labels the result computed', () => {
    expect(difference(amount(800_000), amount(300_000, 'from-quote'))).toEqual({
      ok: true,
      value: { inr: 500_000, provenance: 'computed' },
    });
  });

  it('is negative when the plan is over budget', () => {
    expect(difference(amount(800_000), amount(950_000))).toEqual({
      ok: true,
      value: { inr: -150_000, provenance: 'computed' },
    });
  });

  it('is zero for equal amounts', () => {
    expect(difference(amount(7), amount(7))).toEqual({
      ok: true,
      value: { inr: 0, provenance: 'computed' },
    });
  });

  it('refuses a result outside the safe range', () => {
    expect(difference(amount(Number.MAX_SAFE_INTEGER), amount(-1))).toEqual({
      ok: false,
      reason: 'out-of-range',
    });
  });
});

describe('divideRoundHalfUp', () => {
  it.each([
    ['exact division', 10, 5, 2],
    ['below half rounds down', 7, 5, 1],
    ['exactly half rounds up', 5, 2, 3],
    ['above half rounds up', 8, 5, 2],
    ['zero numerator', 0, 7, 0],
    ['negative below half rounds toward zero', -4, 3, -1],
    ['negative exactly half rounds toward positive infinity', -5, 2, -2],
    ['negative above half rounds away from zero', -2, 3, -1],
    ['negative small magnitude rounds to zero', -1, 3, 0],
  ])('%s: %i / %i = %i', (_name, numerator, divisor, expected) => {
    expect(divideRoundHalfUp(numerator, divisor)).toEqual({ ok: true, value: expected });
  });

  it.each<[string, number, number, MoneyRefusal]>([
    ['zero divisor', 5, 0, 'bad-divisor'],
    ['negative divisor', 5, -2, 'bad-divisor'],
    ['fractional divisor', 5, 0.5, 'bad-divisor'],
    ['fractional numerator', 5.5, 2, 'not-whole-rupees'],
    ['NaN numerator', Number.NaN, 2, 'not-a-number'],
  ])('refuses %s', (_name, numerator, divisor, reason) => {
    expect(divideRoundHalfUp(numerator, divisor)).toEqual({ ok: false, reason });
  });
});

describe('scale', () => {
  it('multiplies by a ratio and labels the result computed', () => {
    expect(scale(amount(800_000), 3, 10)).toEqual({
      ok: true,
      value: { inr: 240_000, provenance: 'computed' },
    });
  });

  it('rounds x.5 up', () => {
    expect(scale(amount(5), 1, 2)).toEqual({ ok: true, value: { inr: 3, provenance: 'computed' } });
    expect(scale(amount(15), 1, 10)).toEqual({
      ok: true,
      value: { inr: 2, provenance: 'computed' },
    });
  });

  it('rounds a negative half toward positive infinity (the documented direction)', () => {
    expect(scale(amount(-5), 1, 2)).toEqual({
      ok: true,
      value: { inr: -2, provenance: 'computed' },
    });
  });

  it('scales zero to zero and anything by zero to zero', () => {
    expect(scale(amount(0), 7, 3)).toEqual({ ok: true, value: { inr: 0, provenance: 'computed' } });
    expect(scale(amount(900), 0, 3)).toEqual({
      ok: true,
      value: { inr: 0, provenance: 'computed' },
    });
  });

  it('stays exact where a double product would not', () => {
    // The intermediate product is 9e17, past 2^53, yet the quotient is exactly 10 crore.
    const result = scale(amount(100_000_000), 9_000_000_000, 9_000_000_000);
    expect(result).toEqual({ ok: true, value: { inr: 100_000_000, provenance: 'computed' } });
  });

  it('refuses a quotient outside the safe range', () => {
    expect(scale(amount(Number.MAX_SAFE_INTEGER), 2, 1)).toEqual({
      ok: false,
      reason: 'out-of-range',
    });
  });

  it.each<[string, number, number, MoneyRefusal]>([
    ['zero denominator', 1, 0, 'bad-divisor'],
    ['negative denominator', 1, -3, 'bad-divisor'],
    ['fractional numerator', 0.5, 3, 'not-whole-rupees'],
  ])('refuses %s', (_name, numerator, denominator, reason) => {
    expect(scale(amount(100), numerator, denominator)).toEqual({ ok: false, reason });
  });
});
