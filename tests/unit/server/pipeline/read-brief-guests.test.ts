import { describe, expect, it } from 'vitest';

import type { BriefReading } from '@/schemas/readings/brief-reading';
import { readBrief } from '@/server/pipeline/read-brief';

import { NO_EXAMPLES, TODAY, briefReading, gatewayAnswering } from './readings';

// A guest count the model marked present but left empty is read from its verified quote by
// the same parser as the budget (D44); anything but one figure stays a question.
async function guestsOf(text: string, quote: string, presence: 'present' | 'unclear' = 'present') {
  const reading: BriefReading = briefReading({ guests: { presence, count: null, quote } });
  const gateway = gatewayAnswering('brief', { reading });
  const outcome = await readBrief({ gateway, examples: NO_EXAMPLES }, { text, today: TODAY });
  if (outcome.kind !== 'check' || outcome.pending.kind !== 'brief') {
    throw new Error(`expected a brief check page, got ${outcome.kind}`);
  }
  const { pending } = outcome;
  return {
    guests: pending.values.guests,
    verdict: pending.fields.find((field) => field.field === 'guests'),
  };
}

describe('readBrief reads a guest count the model left without a number (D44)', () => {
  it.each([
    ['do sau log', 200],
    ['dedh sau log', 150],
    ['\u0926\u094B \u0938\u094C \u0932\u094B\u0917', 200],
    ['250 log', 250],
  ])('fills %s as %i, verified', async (quote, count) => {
    const { guests, verdict } = await guestsOf(`shaadi, ${quote} aayenge`, quote);
    expect(guests).toBe(count);
    expect(verdict).toMatchObject({ status: 'verified', reason: null });
  });

  it.each([
    ['a range in words', 'do-teen sau log'],
    ['a range in digits', '200-300 log'],
    ['an unread compound', 'do sau pachaas log'],
    ['no number at all', 'bahut saare log'],
  ])('keeps %s a question', async (_name, quote) => {
    const { guests, verdict } = await guestsOf(`shaadi, ${quote} aayenge`, quote);
    expect(guests).toBeNull();
    expect(verdict?.status).toBe('unclear');
  });

  it('asks about a number outside the guest bounds with its reason', async () => {
    const { verdict } = await guestsOf('shaadi, das hazaar log aayenge', 'das hazaar log');
    expect(verdict).toMatchObject({ status: 'unverified', reason: 'out-of-bounds' });
  });

  it('fills nothing from a quote that is not in the text', async () => {
    const { guests, verdict } = await guestsOf('shaadi, kuch log aayenge', 'do sau log');
    expect(guests).toBeNull();
    expect(verdict).toMatchObject({ status: 'unverified', reason: 'quote-not-found' });
  });

  it('leaves a count the model called unclear as a question', async () => {
    const { guests, verdict } = await guestsOf('lagbhag do sau log', 'do sau log', 'unclear');
    expect(guests).toBeNull();
    expect(verdict?.status).toBe('unclear');
  });
});
