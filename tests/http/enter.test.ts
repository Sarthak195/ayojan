import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CheckView } from '@/app/[lang]/p/[token]/check/check-view';
import { POST as confirm } from '@/app/[lang]/confirm/route';
import { POST as enter } from '@/app/[lang]/enter/[kind]/route';
import { POST as read } from '@/app/[lang]/read/[kind]/route';
import type { PlanView } from '@/core/plan/plan-view';
import { openPlan } from '@/server/view/plan-page';

import {
  context,
  DATA,
  deps,
  HINGLISH_ANSWERS,
  HINGLISH_FORM,
  HINGLISH_READING,
  HINGLISH_TEXT,
  location,
  post,
  readDeps,
  sources,
  stateOf,
  TODAY,
  tokenOf,
  type Fields,
} from './support';

const BRIEF = context({ lang: 'en', kind: 'brief' });

function enterBrief(fields: Fields): Promise<Response> {
  return enter(post('/en/enter/brief', fields), BRIEF, deps());
}

function viewOf(token: string): PlanView {
  const opened = openPlan(token, sources());
  if (!opened.ok || opened.plan.view === null) throw new Error('plan did not open');
  return opened.plan.view;
}

// The parts of the view a person sees. An unanswered priority is "unclear" from the reader and
// "Standard" on the form; both split the budget alike (D15), so the spelling is normalised.
function seen(view: PlanView): unknown {
  const { current } = view;
  const priorities = Object.fromEntries(
    Object.entries(current.brief.priorities).map(([key, level]) => [
      key,
      level === 'unclear' ? 'standard' : level,
    ]),
  );
  return {
    brief: { ...current.brief, priorities, notes: [] },
    profile: current.profile,
    headline: current.headline,
    projection: current.money.projection,
    schedule: current.schedule,
    banners: view.banners,
    vendors: view.vendors,
  };
}

describe('POST /[lang]/enter/brief', () => {
  it('goes straight to the plan when every value is usable', async () => {
    const response = await enterBrief(HINGLISH_FORM);
    expect(response.status).toBe(303);
    expect(location(response)).toMatch(/^\/en\/p\/[A-Za-z0-9_-]+$/);
    const [op] = stateOf(tokenOf(response)).ops;
    expect(op?.kind === 'briefConfirmed' ? op.readBy.source : null).toBe('form');
  });

  it('sends a value that needs a question to the check page, marked "Entered by form"', async () => {
    const response = await enterBrief({ ...HINGLISH_FORM, budget: '4999' });
    expect(response.status).toBe(303);
    expect(location(response)).toMatch(/\/check$/);
    const state = stateOf(tokenOf(response));
    expect(state.ops).toEqual([]);
    const { pending } = state;
    if (pending?.kind !== 'brief') throw new Error('expected a pending brief');
    expect(pending.readBy.source).toBe('form');
    // The valid values are kept beside the question.
    expect(pending.values.guests).toBe(200);

    const html = renderToStaticMarkup(
      createElement(CheckView, {
        lang: 'en',
        token: tokenOf(response),
        pending,
        today: TODAY,
        weights: DATA.budgetWeights,
        recordedOn: null,
      }),
    );
    expect(html).toContain('Entered by form');
    expect(html).not.toContain('values matched your words');
    expect(html).toContain('Please give a value from Rs 5,000 to Rs 10,00,00,000.');
  });

  it('gives the same plan as the reader for the same facts (FR-5)', async () => {
    const { deps: reading } = readDeps({ reading: HINGLISH_READING });
    const checked = await read(post('/en/read/brief', { brief: HINGLISH_TEXT }), BRIEF, reading);
    const confirmed = await confirm(
      post('/en/confirm', { token: tokenOf(checked), ...HINGLISH_ANSWERS }),
      context({ lang: 'en' }),
      deps(),
    );
    const byForm = await enterBrief(HINGLISH_FORM);

    const fromReader = viewOf(tokenOf(confirmed));
    const fromForm = viewOf(tokenOf(byForm));
    expect(seen(fromForm)).toEqual(seen(fromReader));
    expect(fromReader.ledger[0]?.readBy?.source).toBe('ai');
    expect(fromForm.ledger[0]?.readBy?.source).toBe('form');
  });

  it('answers 400 for a form missing a required choice row, and 404 for an unknown kind', async () => {
    const partial = Object.fromEntries(
      Object.entries(HINGLISH_FORM).filter(([name]) => name !== 'priorityVenue'),
    );
    expect((await enterBrief(partial)).status).toBe(400);
    const unknown = await enter(
      post('/en/enter/menu', HINGLISH_FORM),
      context({ lang: 'en', kind: 'menu' }),
      deps(),
    );
    expect(unknown.status).toBe(404);
  });
});
