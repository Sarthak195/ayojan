import { describe, expect, it } from 'vitest';

import { canonicalise } from '@/core/grounding/canonical-text';
import { locateQuote } from '@/core/grounding/quote-match';
import { verifyReading } from '@/core/grounding/verification';
import { QUOTE_LIMIT_CHARACTERS } from '@/schemas/readings/vocabulary';

// Each generator targets a way the grounding pass could go quadratic: a stamp look-alike on
// every line, long runs of emoji and joiners, combining marks that force the NFC fallback,
// rupee markers next to each other, and punctuation the normalised pass has to strip.
const GENERATORS: readonly (readonly [string, string])[] = [
  ['stamp look-alikes on every line', '[26/10/26, 9:41 pm] '.repeat(250)],
  ['near-stamps with a long name', `\n26/10/26, 9:41 pm - ${'n'.repeat(59)}`.repeat(60)],
  ['emoji run', '\u{1F389}'.repeat(1_500)],
  ['emoji joined by zero-width joiners', '\u{1F468}‍'.repeat(700)],
  ['combining marks on one letter', `a${'́'.repeat(1_500)}`],
  ['decomposed nukta letters', 'ज़'.repeat(1_000)],
  ['rupee markers back to back', 'rs.Rs INR₹'.repeat(400)],
  ['curly quotes and dashes', '“—’'.repeat(1_000)],
  ['nested punctuation', '((((1,((2,((3.'.repeat(300)],
  ['repeated lakh', '8 lakh '.repeat(700)],
];

const BUDGET_MS = 250;

function adversarial(): string {
  return GENERATORS.map(([, text]) => text)
    .join(' ')
    .slice(0, 10_000);
}

// Best of three, after a warm-up run, so a garbage-collection pause or JIT compile in one
// run does not count against the pass.
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

describe('grounding is linear on adversarial input', () => {
  const text = adversarial();
  // A quote that is absent forces both the exact and the normalised pass over the whole text.
  const missingQuote = `8 lakh ${'z'.repeat(QUOTE_LIMIT_CHARACTERS - 7)}`;

  it('builds a 10,000 character adversarial input', () => {
    expect(text).toHaveLength(10_000);
  });

  it.each(GENERATORS)('canonicalises %s inside the budget', (_name, input) => {
    expect(bestMs(() => canonicalise(input))).toBeLessThan(BUDGET_MS);
  });

  it('canonicalises, matches and verifies the whole input inside the budget', () => {
    const elapsed = bestMs(() => {
      const source = canonicalise(text);
      locateQuote(source, missingQuote);
      verifyReading(text, {
        budget: {
          presence: 'present',
          quote: '8 lakh',
          numbers: [{ value: 800_000, inQuote: true }],
        },
        missing: { presence: 'present', quote: missingQuote },
      });
    });
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
