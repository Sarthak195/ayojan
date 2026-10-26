import { describe, expect, it } from 'vitest';

import { amountsIn, parseAmount, scanAmounts } from '@/core/rupees/parse';

// Each generator targets a different way a scanner could go quadratic: long digit runs,
// repeated unit words, separators that almost form a number, and look-ahead phrases.
const GENERATORS: readonly (readonly [string, string])[] = [
  ['one long digit run', '9'.repeat(10_000)],
  ['repeated lakh', 'lakh '.repeat(2_000)],
  ['alternating digit and comma', '1,'.repeat(5_000)],
  ['almost-valid Indian grouping', '1,23,45,67,89,'.repeat(715)],
  ['alternating digit and unit', '8 lakh '.repeat(1_430)],
  ['repeated Hindi prefix', 'saadhe '.repeat(1_430)],
  ['prefix before long digits', `saadhe ${'7'.repeat(9_990)}`],
  ['Hindi words chain', 'dedh '.repeat(2_000)],
  ['nested punctuation', '((((1,((2,((3.'.repeat(715)],
  ['long spaces between number and unit', `5${' '.repeat(9_990)}lakh`],
  ['one giant word', 'a'.repeat(10_000)],
  ['digits and dots', '1.'.repeat(5_000)],
  ['emoji run', '🎉'.repeat(5_000)],
  ['Devanagari digits and words', '८ लाख '.repeat(1_400)],
];

// Catastrophic backtracking on 10,000 characters takes seconds or never ends, while a linear
// scan takes a few milliseconds. The budget sits far between the two, so a slow or busy CI
// runner cannot turn it red, yet any regex that goes super-linear still fails it.
const BUDGET_MS = 250;

function adversarial(): string {
  const parts = GENERATORS.map(([, text]) => text);
  return parts.join(' ').slice(0, 10_000);
}

// Best of three, after a warm-up run, so a garbage-collection pause or JIT compile in one
// run does not count against the scanner.
function bestMs(run: () => void): number {
  run();
  let best = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const started = performance.now();
    run();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

describe('the scanner is linear on adversarial input', () => {
  it('parses a 10,000 character adversarial string inside the budget', () => {
    const text = adversarial();
    expect(text).toHaveLength(10_000);
    expect(bestMs(() => scanAmounts(text))).toBeLessThan(BUDGET_MS);
  });

  it.each(GENERATORS)('%s: 10,000 characters finish inside the budget', (_name, text) => {
    expect(text.length).toBeLessThanOrEqual(10_100);
    expect(bestMs(() => scanAmounts(text))).toBeLessThan(BUDGET_MS);
    expect(bestMs(() => parseAmount(text))).toBeLessThan(BUDGET_MS);
    expect(bestMs(() => amountsIn(text))).toBeLessThan(BUDGET_MS);
  });

  it('takes about four times as long for four times the input, not sixteen times', () => {
    const small = 'saadhe 1,23,45,67 lakh dedh '.repeat(700);
    const large = small.repeat(4);
    const smallTime = Math.max(
      bestMs(() => scanAmounts(small)),
      0.5,
    );
    const largeTime = bestMs(() => scanAmounts(large));
    // A quadratic scan would give a ratio near 16; best-of-three keeps timer noise out.
    expect(largeTime / smallTime).toBeLessThan(10);
  });
});
