import { join } from 'node:path';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { POST as read } from '@/app/[lang]/read/[kind]/route';
import { createExampleBook, loadExamples } from '@/server/pipeline/example-readings';

import { context, location, post, stateOf } from '../support';
import { BRIEF_OP, CATERER_A_TEXT, CATERER_B_TEXT, planToken, quoteDeps, tokenIn } from './support';

const QUOTE = context({ lang: 'en', kind: 'quote' });

// The committed sample quotes and their recordings, as production loads them.
const BOOK = createExampleBook(
  loadExamples((path) => {
    try {
      return readFileSync(join(process.cwd(), path), 'utf8');
    } catch {
      return undefined;
    }
  }),
);

describe('the quote reader when no model call succeeds (FR-40)', () => {
  it.each(['quota', 'timeout', 'nokey'] as const)(
    'answers %s with a 303 to the open quote form, the plan unchanged',
    async (failure) => {
      const { deps } = quoteDeps(failure);
      const token = planToken();
      const response = await read(
        post('/en/read/quote', { token, quote: 'Rate 900 per plate' }),
        QUOTE,
        deps,
      );
      expect(response.status).toBe(303);
      // The posted link itself: nothing was read, so nothing new is sealed.
      expect(location(response)).toBe(
        `/en/p/${token}/quotes?ai=unavailable&why=${failure}#quote-form`,
      );
    },
  );

  it('shows our own reader failure as "did not answer in time", never a 500', async () => {
    const { deps } = quoteDeps('schema-violation');
    const token = planToken();
    const response = await read(post('/en/read/quote', { token, quote: 'Rate 900' }), QUOTE, deps);
    expect(response.status).toBe(303);
    expect(location(response)).toBe(`/en/p/${token}/quotes?ai=unavailable&why=timeout#quote-form`);
  });

  it.each([
    ['Caterer A', CATERER_A_TEXT, 'perPlate'],
    ['Caterer B', CATERER_B_TEXT, 'lumpSum'],
  ])(
    'serves the sample quote for %s from its labelled recording when quota is spent',
    async (_name, text, basis) => {
      const { gateway, deps } = quoteDeps('quota', BOOK);
      const response = await read(
        post('/en/read/quote', { token: planToken(), quote: text }),
        QUOTE,
        deps,
      );
      expect(location(response)).toMatch(/\/check#check-summary$/);
      expect(gateway.calls).toHaveLength(1);
      const state = stateOf(tokenIn(response));
      expect(state.ops).toEqual([BRIEF_OP]);
      const pending = state.pending;
      if (pending?.kind !== 'quote') throw new Error('expected a quote reading');
      expect(pending.readBy.source).toBe('example');
      expect(pending.values.basis).toBe(basis);
    },
  );

  it('reads an edited sample live, never as the example', async () => {
    const { deps } = quoteDeps('quota', BOOK);
    const edited = CATERER_A_TEXT.replace('1300', '1350');
    const token = planToken();
    const response = await read(post('/en/read/quote', { token, quote: edited }), QUOTE, deps);
    expect(location(response)).toBe(`/en/p/${token}/quotes?ai=unavailable&why=quota#quote-form`);
  });
});
