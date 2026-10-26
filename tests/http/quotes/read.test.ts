import { describe, expect, it } from 'vitest';

import { POST as read } from '@/app/[lang]/read/[kind]/route';

import {
  context,
  HINGLISH_READING,
  HINGLISH_TEXT,
  location,
  post,
  readDeps,
  stateOf,
  tokenOf,
} from '../support';
import {
  BRIEF_OP,
  CATERER_A_READING,
  CATERER_A_TEXT,
  INJECTION_READING,
  INJECTION_TEXT,
  PASTED_WORDS,
  planToken,
  quoteDeps,
  SIX_QUOTES,
  stdoutDuring,
} from './support';

const QUOTE = context({ lang: 'en', kind: 'quote' });

describe('POST /[lang]/read/quote', () => {
  it('reads once, keeps the plan and 303s to the check page with each value and its words', async () => {
    const { gateway, deps } = quoteDeps({ reading: CATERER_A_READING });
    const token = planToken();
    const response = await read(
      post('/en/read/quote', { token, quote: CATERER_A_TEXT }),
      QUOTE,
      deps,
    );

    expect(response.status).toBe(303);
    expect(location(response)).toMatch(/^\/en\/p\/[A-Za-z0-9_-]+\/check$/);
    expect(gateway.calls).toHaveLength(1);
    const state = stateOf(tokenOf(response));
    // A read appends nothing (NFR-ALN-7): the brief is still the only op.
    expect(state.ops).toEqual([BRIEF_OP]);
    const pending = state.pending;
    expect(pending?.kind).toBe('quote');
    if (pending?.kind !== 'quote') return;
    expect(pending.readBy.source).toBe('ai');
    expect(pending.values).toMatchObject({
      category: 'catering',
      basis: 'perPlate',
      rateInr: 1_300,
      minimumGuests: 200,
      tax: 'extraRateUnstated',
      taxBasisPoints: null,
      advancePercent: 30,
      extras: [{ key: 'liveCounter', amountInr: 15_000 }],
    });
    const quotes = pending.fields.map((field) => field.displayQuote);
    for (const words of [
      '1300/plate',
      'min 200 plate',
      'GST extra',
      'live chaat counter 15k alag',
      'advance 30%',
    ]) {
      expect(quotes).toContain(words);
    }
  });

  it('never puts a pasted word into the Location or any log line', async () => {
    const { deps } = quoteDeps({ reading: CATERER_A_READING });
    const token = planToken();
    let response: Response | undefined;
    const stdout = await stdoutDuring(async () => {
      response = await read(post('/en/read/quote', { token, quote: CATERER_A_TEXT }), QUOTE, deps);
    });
    const target = response === undefined ? '' : location(response);
    expect(target).not.toContain('?');
    // Only the structured log lines: the test runner may write its own output meanwhile.
    const logLines = stdout.split('\n').filter((line) => line.startsWith('{"severity"'));
    expect(logLines.length).toBeGreaterThan(0);
    const logged = `${logLines.join('\n')}\n${JSON.stringify(deps.logger)}`;
    for (const word of PASTED_WORDS) {
      expect(target.toLowerCase()).not.toContain(word.toLowerCase());
      expect(logged.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('reads a planted instruction as a rate and nothing else (FR-22)', async () => {
    const { deps } = quoteDeps({ reading: INJECTION_READING });
    const token = planToken();
    const response = await read(
      post('/en/read/quote', { token, quote: INJECTION_TEXT }),
      QUOTE,
      deps,
    );
    const state = stateOf(tokenOf(response));
    expect(state.ops).toEqual([BRIEF_OP]);
    const pending = state.pending;
    if (pending?.kind !== 'quote') throw new Error('expected a quote reading');
    expect(pending.values).toEqual({
      category: null,
      basis: 'perPlate',
      rateInr: 1_100,
      minimumGuests: null,
      guestsCovered: null,
      tax: 'absent',
      taxBasisPoints: null,
      extras: [],
      inclusions: [],
      advancePercent: null,
    });
  });

  it.each([
    ['no token', { quote: 'x' }],
    ['blank text', { token: 'abc', quote: '   ' }],
    ['an unknown field', { token: 'abc', quote: 'x', brief: 'y' }],
  ])('answers 400 for %s and calls no model', async (_case, fields) => {
    const { gateway, deps } = quoteDeps({ reading: CATERER_A_READING });
    expect((await read(post('/en/read/quote', fields), QUOTE, deps)).status).toBe(400);
    expect(gateway.calls).toHaveLength(0);
  });

  it('answers 400 for a damaged link and 422 for a link with no plan yet', async () => {
    const { gateway, deps } = quoteDeps({ reading: CATERER_A_READING });
    const damaged = await read(post('/en/read/quote', { token: 'abc', quote: 'x' }), QUOTE, deps);
    expect(damaged.status).toBe(400);
    // A brief read but not yet confirmed: the link holds no plan to add a quote to.
    const { deps: briefDeps } = readDeps({ reading: HINGLISH_READING });
    const briefRead = await read(
      post('/en/read/brief', { brief: HINGLISH_TEXT }),
      context({ lang: 'en', kind: 'brief' }),
      briefDeps,
    );
    const noPlan = tokenOf(briefRead);
    const early = await read(post('/en/read/quote', { token: noPlan, quote: 'x' }), QUOTE, deps);
    expect(early.status).toBe(422);
    expect(gateway.calls).toHaveLength(0);
  });

  it('refuses a seventh quote with 422 before the model is asked', async () => {
    const { gateway, deps } = quoteDeps({ reading: CATERER_A_READING });
    const token = planToken(SIX_QUOTES);
    const response = await read(
      post('/en/read/quote', { token, quote: CATERER_A_TEXT }),
      QUOTE,
      deps,
    );
    expect(response.status).toBe(422);
    expect(gateway.calls).toHaveLength(0);
    expect(await response.text()).toContain(`href="/en/p/${token}"`);
  });

  it('answers 422 for a quote over 2,000 code points and calls no model', async () => {
    const { gateway, deps } = quoteDeps({ reading: CATERER_A_READING });
    const long = post('/en/read/quote', { token: planToken(), quote: 'क'.repeat(2_001) });
    expect((await read(long, QUOTE, deps)).status).toBe(422);
    expect(gateway.calls).toHaveLength(0);
  });
});
