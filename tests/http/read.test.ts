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
} from './support';

const BRIEF = context({ lang: 'en', kind: 'brief' });

describe('POST /[lang]/read/brief', () => {
  it('reads once, seals the reading into the link and 303s to the check page', async () => {
    const { gateway, deps } = readDeps({ reading: HINGLISH_READING });
    const response = await read(post('/en/read/brief', { brief: HINGLISH_TEXT }), BRIEF, deps);

    expect(response.status).toBe(303);
    expect(location(response)).toMatch(/^\/en\/p\/[A-Za-z0-9_-]+\/check$/);
    expect(gateway.calls).toHaveLength(1);

    const state = stateOf(tokenOf(response));
    // A read appends nothing to a plan (NFR-ALN-7); only confirm adds an op.
    expect(state.ops).toEqual([]);
    expect(state.pending?.kind).toBe('brief');
    expect(state.pending?.readBy.source).toBe('ai');
    const quotes = state.pending?.fields.map((field) => field.displayQuote);
    expect(quotes).toContain('budget 8 lakh');
    expect(quotes).toContain('Feb end mein');
  });

  it('never puts a word of the brief into the Location', async () => {
    const { deps } = readDeps({ reading: HINGLISH_READING });
    const response = await read(post('/en/read/brief', { brief: HINGLISH_TEXT }), BRIEF, deps);
    const target = location(response);
    // The sealed token is random base64url and can spell a short word by chance, so the shape
    // check proves it is the only variable part and the words are sought in the rest.
    expect(target).toMatch(/^\/en\/p\/[A-Za-z0-9_-]+\/check$/);
    const fixedParts = target.replace(/\/p\/[A-Za-z0-9_-]+\//, '/p/<token>/');
    for (const word of ['shaadi', 'lakh', 'Indore', 'budget', '200', 'Dhol']) {
      expect(fixedParts.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('keeps the Hindi page in Hindi', async () => {
    const { deps } = readDeps({ reading: HINGLISH_READING });
    const response = await read(
      post('/hi/read/brief', { brief: HINGLISH_TEXT }),
      context({ lang: 'hi', kind: 'brief' }),
      deps,
    );
    expect(location(response)).toMatch(/^\/hi\/p\/[A-Za-z0-9_-]+\/check$/);
  });

  it.each([
    ['a missing brief field', { other: 'x' }],
    ['blank text', { brief: '   ' }],
    ['an unknown extra field', { brief: 'Shaadi, 8 lakh', token: 'abc' }],
  ])('answers 400 for %s and calls no model', async (_case, fields) => {
    const { gateway, deps } = readDeps({ reading: HINGLISH_READING });
    const response = await read(post('/en/read/brief', fields), BRIEF, deps);
    expect(response.status).toBe(400);
    expect(gateway.calls).toHaveLength(0);
  });

  it('answers 400 for a body that is not UTF-8', async () => {
    const { gateway, deps } = readDeps({ reading: HINGLISH_READING });
    const request = new Request('http://localhost/en/read/brief', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'brief=%FF%FE',
    });
    expect((await read(request, BRIEF, deps)).status).toBe(400);
    expect(gateway.calls).toHaveLength(0);
  });

  it('answers 415 for JSON and 422 for text over 2,000 code points', async () => {
    const { deps } = readDeps({ reading: HINGLISH_READING });
    const json = post('/en/read/brief', { brief: 'x' }, 'application/json');
    expect((await read(json, BRIEF, deps)).status).toBe(415);
    const long = post('/en/read/brief', { brief: 'a'.repeat(2_001) });
    expect((await read(long, BRIEF, deps)).status).toBe(422);
  });

  it('answers 404 for an unknown kind or language', async () => {
    const { gateway, deps } = readDeps({ reading: HINGLISH_READING });
    const kind = await read(
      post('/en/read/menu', { brief: 'x' }),
      context({ lang: 'en', kind: 'menu' }),
      deps,
    );
    expect(kind.status).toBe(404);
    const lang = await read(
      post('/fr/read/brief', { brief: 'x' }),
      context({ lang: 'fr', kind: 'brief' }),
      deps,
    );
    expect(lang.status).toBe(404);
    expect(gateway.calls).toHaveLength(0);
  });
});
