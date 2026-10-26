import { describe, expect, it } from 'vitest';

import { POST as confirm } from '@/app/[lang]/confirm/route';
import { POST as read } from '@/app/[lang]/read/[kind]/route';

import { context, deps, location, post, stateOf, tokenOf, type Fields } from '../support';
import {
  BRIEF_OP,
  CATERER_A,
  CATERER_A_CHECK,
  CATERER_A_READING,
  CATERER_A_TEXT,
  INJECTION_READING,
  INJECTION_TEXT,
  planToken,
  quoteDeps,
  SIX_QUOTES,
  tokenIn,
  without,
} from './support';

const QUOTE_VALUES = without(CATERER_A, 'id');

const EN = context({ lang: 'en' });

async function readToken(reading: unknown, text: string, token = planToken()): Promise<string> {
  const { deps: reader } = quoteDeps({ reading });
  const response = await read(
    post('/en/read/quote', { token, quote: text }),
    context({ lang: 'en', kind: 'quote' }),
    reader,
  );
  return tokenOf(response);
}

async function confirmWith(token: string, fields: Fields): Promise<Response> {
  return confirm(post('/en/confirm', { token, ...fields }), EN, deps());
}

describe('POST /[lang]/confirm for a read quote', () => {
  it('appends one quoteAdded op as Caterer A and 303s to the quotes page', async () => {
    const pendingToken = await readToken(CATERER_A_READING, CATERER_A_TEXT);
    const response = await confirmWith(pendingToken, CATERER_A_CHECK);

    expect(response.status).toBe(303);
    expect(location(response)).toMatch(/^\/en\/p\/[A-Za-z0-9_-]+\/quotes$/);
    const state = stateOf(tokenIn(response));
    expect(state.pending).toBeUndefined();
    expect(state.ops).toHaveLength(2);
    const op = state.ops[1];
    if (op?.kind !== 'quoteAdded') throw new Error('expected a quoteAdded op');
    expect(op.readBy.source).toBe('ai');
    // Only structured fields are stored, never the pasted message (FR-15).
    expect(op.quote).toEqual({
      ...CATERER_A,
      extras: [{ key: 'liveCounter', label: 'Live counter', amountInr: 15_000 }],
      inclusions: ['2 sweet incl'],
    });
    expect(JSON.stringify(state)).not.toContain('Namaste');
  });

  it('keeps an edited value: the rate changed on the check page', async () => {
    const pendingToken = await readToken(CATERER_A_READING, CATERER_A_TEXT);
    const response = await confirmWith(pendingToken, { ...CATERER_A_CHECK, rateInr: '1350' });
    const op = stateOf(tokenIn(response)).ops[1];
    expect(op?.kind === 'quoteAdded' ? op.quote.rateInr : null).toBe(1_350);
  });

  it('takes the next free letter after the quotes already held', async () => {
    const pendingToken = await readToken(CATERER_A_READING, CATERER_A_TEXT, planToken([CATERER_A]));
    const op = stateOf(tokenIn(await confirmWith(pendingToken, CATERER_A_CHECK))).ops[2];
    expect(op?.kind === 'quoteAdded' ? op.quote.id : null).toBe('B');
  });

  it('asks again, with no op added, when the category is still unanswered', async () => {
    const pendingToken = await readToken(INJECTION_READING, INJECTION_TEXT);
    const withoutCategory = without(CATERER_A_CHECK, 'category');
    const response = await confirmWith(pendingToken, { ...withoutCategory, rateInr: '1100' });
    expect(response.status).toBe(303);
    expect(location(response)).toMatch(/\/check$/);
    const state = stateOf(tokenOf(response));
    expect(state.ops).toEqual([BRIEF_OP]);
    expect(state.pending?.kind).toBe('quote');
    // The vendor's words stay beside their values on the page asked again.
    expect(state.pending?.fields.map((field) => field.displayQuote)).toContain('1100/plate');
  });

  it('asks again when the advance is above 100 percent', async () => {
    const pendingToken = await readToken(CATERER_A_READING, CATERER_A_TEXT);
    const response = await confirmWith(pendingToken, { ...CATERER_A_CHECK, advancePercent: '150' });
    expect(location(response)).toMatch(/\/check$/);
    const advance = stateOf(tokenOf(response)).pending?.fields.find(
      (field) => field.field === 'advancePercent',
    );
    expect(advance).toMatchObject({ status: 'unclear', reason: 'out-of-bounds' });
  });

  it('cancels back to the plan with its ops kept and the reading dropped', async () => {
    const pendingToken = await readToken(CATERER_A_READING, CATERER_A_TEXT);
    const response = await confirmWith(pendingToken, { intent: 'cancel' });
    expect(location(response)).toMatch(/^\/en\/p\/[A-Za-z0-9_-]+$/);
    const state = stateOf(tokenOf(response));
    expect(state).toEqual({ schema: 1, ops: [BRIEF_OP] });
  });

  it('refuses a seventh quote with 422 and leaves the plan unchanged', async () => {
    const full = planToken(SIX_QUOTES, {
      kind: 'quote',
      values: QUOTE_VALUES,
      fields: [],
      readBy: { source: 'ai', model: null, matched: 0, total: 0 },
    });
    const response = await confirmWith(full, CATERER_A_CHECK);
    expect(response.status).toBe(422);
  });

  it('answers 400 for a value of the wrong shape', async () => {
    const pendingToken = await readToken(CATERER_A_READING, CATERER_A_TEXT);
    const response = await confirmWith(pendingToken, { ...CATERER_A_CHECK, rateInr: '13.5' });
    expect(response.status).toBe(400);
  });
});
