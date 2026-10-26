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

function adversarial(): string {
  const parts = GENERATORS.map(([, text]) => text);
  return parts.join(' ').slice(0, 10_000);
}

function elapsedMs(run: () => void): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

describe('the scanner is linear on adversarial input', () => {
  it('parses a 10,000 character adversarial string within a few milliseconds', () => {
    const text = adversarial();
    expect(text).toHaveLength(10_000);
    // Warm-up compiles the code paths so the measurement is of the scan, not of the JIT.
    scanAmounts(text);
    const best = Math.min(
      elapsedMs(() => scanAmounts(text)),
      elapsedMs(() => scanAmounts(text)),
      elapsedMs(() => scanAmounts(text)),
    );
    expect(best).toBeLessThan(20);
  });

  it.each(GENERATORS)('%s: 10,000 characters finish well under the 50 ms budget', (_name, text) => {
    expect(text.length).toBeLessThanOrEqual(10_100);
    scanAmounts(text);
    expect(elapsedMs(() => scanAmounts(text))).toBeLessThan(50);
    expect(elapsedMs(() => parseAmount(text))).toBeLessThan(50);
    expect(elapsedMs(() => amountsIn(text))).toBeLessThan(50);
  });

  it('takes about four times as long for four times the input, not sixteen times', () => {
    const small = 'saadhe 1,23,45,67 lakh dedh '.repeat(350);
    const large = small.repeat(4);
    scanAmounts(large);
    const smallTime = Math.max(
      elapsedMs(() => scanAmounts(small)),
      1,
    );
    const largeTime = elapsedMs(() => scanAmounts(large));
    // A quadratic scan would give a ratio near 16; the margin absorbs timer noise.
    expect(largeTime / smallTime).toBeLessThan(10);
  });
});
