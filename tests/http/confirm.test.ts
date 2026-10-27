import { describe, expect, it } from 'vitest';

import { POST as confirm } from '@/app/[lang]/confirm/route';
import { POST as read } from '@/app/[lang]/read/[kind]/route';

import { BRIEF_STATE } from '../unit/server/http/step-support';
import {
  context,
  deps,
  HINGLISH_ANSWERS,
  HINGLISH_READING,
  HINGLISH_TEXT,
  location,
  post,
  readDeps,
  seal,
  stateOf,
  tokenOf,
  type Fields,
} from './support';

const EN = context({ lang: 'en' });

async function readToken(): Promise<string> {
  const { deps: reading } = readDeps({ reading: HINGLISH_READING });
  const response = await read(
    post('/en/read/brief', { brief: HINGLISH_TEXT }),
    context({ lang: 'en', kind: 'brief' }),
    reading,
  );
  return tokenOf(response);
}

async function confirmWith(token: string, fields: Fields): Promise<Response> {
  return confirm(post('/en/confirm', { token, ...fields }), EN, deps());
}

describe('POST /[lang]/confirm', () => {
  it('appends the brief as the one op and 303s to the plan', async () => {
    const response = await confirmWith(await readToken(), HINGLISH_ANSWERS);
    expect(response.status).toBe(303);
    expect(location(response)).toMatch(/^\/en\/p\/[A-Za-z0-9_-]+$/);
    const state = stateOf(tokenOf(response));
    expect(state.pending).toBeUndefined();
    expect(state.ops).toHaveLength(1);
    const [op] = state.ops;
    expect(op?.kind).toBe('briefConfirmed');
    if (op?.kind !== 'briefConfirmed') return;
    expect(op.readBy.source).toBe('ai');
    expect(op.brief).toMatchObject({ budgetInr: 800_000, guests: 200, eventDate: '2027-02-26' });
    expect(op.brief.priorities.catering).toBe('more');
    expect(op.brief.notes).toEqual(['DJ chahiye']);
  });

  it('returns to the check page with no op while the date is unanswered', async () => {
    const token = await readToken();
    const response = await confirmWith(token, { ...HINGLISH_ANSWERS, eventDate: '' });
    expect(response.status).toBe(303);
    expect(location(response)).toMatch(/\/check#check-summary$/);
    const state = stateOf(tokenOf(response));
    expect(state.ops).toEqual([]);
    expect(state.pending?.kind).toBe('brief');
    // What was answered is kept for the next try.
    if (state.pending?.kind === 'brief') expect(state.pending.values.budgetInr).toBe(800_000);
  });

  it('accepts Hindi number words in an answer', async () => {
    const response = await confirmWith(await readToken(), {
      ...HINGLISH_ANSWERS,
      budget: 'dedh lakh',
    });
    const [op] = stateOf(tokenOf(response)).ops;
    expect(op?.kind === 'briefConfirmed' ? op.brief.budgetInr : null).toBe(150_000);
  });

  it('asks again for a date that has passed, never 4xx', async () => {
    const response = await confirmWith(await readToken(), {
      ...HINGLISH_ANSWERS,
      eventDate: '2026-10-01',
    });
    expect(response.status).toBe(303);
    expect(location(response)).toMatch(/\/check#check-summary$/);
  });

  it('cancels a first brief back to the start page', async () => {
    const response = await confirmWith(await readToken(), { intent: 'cancel' });
    expect(response.status).toBe(303);
    expect(location(response)).toBe('/en');
  });

  it('refuses a confirm with nothing pending (422) and a damaged link (400)', async () => {
    const nothing = await confirmWith(seal(BRIEF_STATE), { intent: 'confirm' });
    expect(nothing.status).toBe(422);
    const token = await readToken();
    const damaged = `${token.slice(0, 20)}${token[20] === 'A' ? 'B' : 'A'}${token.slice(21)}`;
    expect((await confirmWith(damaged, HINGLISH_ANSWERS)).status).toBe(400);
  });
});
