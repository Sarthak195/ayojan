import { describe, expect, it } from 'vitest';

import { POST as confirm } from '@/app/[lang]/confirm/route';
import { POST as enter } from '@/app/[lang]/enter/[kind]/route';
import { POST as read } from '@/app/[lang]/read/[kind]/route';

import { context, deps, location, post, stateOf, tokenOf } from '../support';
import {
  CATERER_A,
  CATERER_A_CHECK,
  CATERER_A_READING,
  CATERER_A_TEXT,
  CATERER_B,
  CATERER_B_FORM,
  planToken,
  quoteDeps,
  SIX_QUOTES,
  tokenIn,
  without,
} from './support';

const ENTER = context({ lang: 'en', kind: 'quote' });

async function enterQuote(fields: Record<string, string | readonly string[]>, token = planToken()) {
  // Plain step deps: there is no gateway here at all, so the twin cannot call a model.
  return enter(post('/en/enter/quote', { token, ...fields }), ENTER, deps());
}

describe('POST /[lang]/enter/quote (the quote form twin)', () => {
  it('appends the quote marked "entered by form" and 303s to the quotes page', async () => {
    const response = await enterQuote(CATERER_B_FORM, planToken([CATERER_A]));
    expect(response.status).toBe(303);
    expect(location(response)).toMatch(/^\/en\/p\/[A-Za-z0-9_-]+\/quotes$/);
    const state = stateOf(tokenIn(response));
    const op = state.ops[2];
    if (op?.kind !== 'quoteAdded') throw new Error('expected a quoteAdded op');
    expect(op.readBy).toEqual({ source: 'form', model: null, matched: 0, total: 0 });
    expect(op.quote).toEqual({
      ...CATERER_B,
      extras: [{ key: 'liveCounter', label: 'Live counter', amountInr: 15_000 }],
    });
  });

  it('stores a stated GST rate in basis points and never assumes one', async () => {
    const rated = await enterQuote({
      ...CATERER_B_FORM,
      tax: 'extraWithRate',
      taxRatePercent: '18',
    });
    const withRate = stateOf(tokenIn(rated)).ops[1];
    expect(withRate?.kind === 'quoteAdded' ? withRate.quote : null).toMatchObject({
      tax: 'extraWithRate',
      taxBasisPoints: 1_800,
    });
    const unrated = await enterQuote({
      ...CATERER_B_FORM,
      tax: 'extraWithRate',
      taxRatePercent: '',
    });
    const noRate = stateOf(tokenIn(unrated)).ops[1];
    expect(noRate?.kind === 'quoteAdded' ? noRate.quote : null).toMatchObject({
      tax: 'extraRateUnstated',
      taxBasisPoints: null,
    });
  });

  it('makes the same quote as reading the message and confirming it (FR-16)', async () => {
    const { deps: reader } = quoteDeps({ reading: CATERER_A_READING });
    const readResponse = await read(
      post('/en/read/quote', { token: planToken(), quote: CATERER_A_TEXT }),
      ENTER,
      reader,
    );
    const confirmed = await confirm(
      post('/en/confirm', { token: tokenOf(readResponse), ...CATERER_A_CHECK }),
      context({ lang: 'en' }),
      deps(),
    );
    const twinFields = without(CATERER_A_CHECK, 'intent');
    const typed = await enterQuote(twinFields);
    const fromRead = stateOf(tokenIn(confirmed)).ops[1];
    const fromForm = stateOf(tokenIn(typed)).ops[1];
    if (fromRead?.kind !== 'quoteAdded' || fromForm?.kind !== 'quoteAdded') {
      throw new Error('expected two quoteAdded ops');
    }
    expect(fromForm.quote).toEqual(fromRead.quote);
    expect(fromForm.readBy.source).toBe('form');
    expect(fromRead.readBy.source).toBe('ai');
  });

  it('goes to the check page when the advance is above 100 percent', async () => {
    const response = await enterQuote({ ...CATERER_B_FORM, advancePercent: '150' });
    expect(location(response)).toMatch(/\/check#check-summary$/);
    const state = stateOf(tokenIn(response));
    expect(state.ops).toHaveLength(1);
    expect(state.pending?.readBy.source).toBe('form');
  });

  it('refuses a seventh quote with 422 and links back to the plan', async () => {
    const token = planToken(SIX_QUOTES);
    const response = await enterQuote(CATERER_B_FORM, token);
    expect(response.status).toBe(422);
    expect(await response.text()).toContain(`href="/en/p/${token}"`);
  });

  it.each([
    ['a missing category', { ...CATERER_B_FORM, category: undefined }],
    ['an unknown basis', { ...CATERER_B_FORM, basis: 'perGuest' }],
    ['a fractional rate', { ...CATERER_B_FORM, rateInr: '1300.5' }],
    ['a GST rate in words', { ...CATERER_B_FORM, taxRatePercent: 'eighteen' }],
  ])('answers 400 for %s', async (_case, fields) => {
    const defined = Object.fromEntries(
      Object.entries(fields).filter(
        (entry): entry is [string, string | string[]] => entry[1] !== undefined,
      ),
    );
    expect((await enterQuote(defined)).status).toBe(400);
  });

  it('answers 400 for a damaged link and 404 for an unknown kind', async () => {
    expect((await enterQuote(CATERER_B_FORM, 'abc')).status).toBe(400);
    const unknown = await enter(
      post('/en/enter/vendor', { token: planToken(), ...CATERER_B_FORM }),
      context({ lang: 'en', kind: 'vendor' }),
      deps(),
    );
    expect(unknown.status).toBe(404);
  });
});
