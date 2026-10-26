import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { showsFunctions } from '@/app/[lang]/p/[token]/check/brief-answers';
import { CheckView } from '@/app/[lang]/p/[token]/check/check-view';
import { POST as confirm } from '@/app/[lang]/confirm/route';
import { POST as enter } from '@/app/[lang]/enter/[kind]/route';
import { emptyDraft } from '@/core/brief/brief-draft';
import { openPlan } from '@/server/view/plan-page';

import {
  context,
  DATA,
  deps,
  HINGLISH_FORM,
  location,
  post,
  sources,
  stateOf,
  TODAY,
  tokenOf,
  type Fields,
} from './support';

const UNSURE = {
  functionHaldi: 'unsure',
  functionMehndi: 'unsure',
  functionSangeet: 'unsure',
  functionWedding: 'unsure',
  functionReception: 'unsure',
};

// A brief with one value to ask (the budget), so the form twin stops at the check page.
async function checkPageFor(occasion: string): Promise<{ token: string; html: string }> {
  const fields: Fields = { ...HINGLISH_FORM, ...UNSURE, occasion, budget: '4999' };
  const response = await enter(
    post('/en/enter/brief', fields),
    context({ lang: 'en', kind: 'brief' }),
    deps(),
  );
  expect(location(response)).toMatch(/\/check$/);
  const token = tokenOf(response);
  const { pending } = stateOf(token);
  if (pending?.kind !== 'brief') throw new Error('expected a pending brief');
  const view = createElement(CheckView, {
    lang: 'en',
    token,
    pending,
    today: TODAY,
    weights: DATA.budgetWeights,
    recordedOn: null,
  });
  return { token, html: renderToStaticMarkup(view) };
}

describe('the wedding function rows on the check page', () => {
  it('shows them for a wedding', async () => {
    const { html } = await checkPageFor('wedding');
    expect(html).toContain('name="functionHaldi"');
    expect(html).toContain('Functions, priorities and needs');
  });

  it('leaves them out for an anniversary, and the page without them still confirms', async () => {
    const { token, html } = await checkPageFor('anniversary');
    expect(html).not.toContain('name="function');
    expect(html).not.toContain('These are wedding functions');
    expect(html).toContain('Priorities and needs');

    // What a browser without JavaScript posts: every row on the page, and no function row.
    const fields = Object.fromEntries(
      Object.entries(HINGLISH_FORM).filter(([name]) => !name.startsWith('function')),
    );
    const response = await confirm(
      post('/en/confirm', {
        ...fields,
        token,
        intent: 'confirm',
        occasion: 'anniversary',
        budget: '150000',
      }),
      context({ lang: 'en' }),
      deps(),
    );
    expect(response.status).toBe(303);
    const opened = openPlan(tokenOf(response), sources());
    if (!opened.ok || opened.plan.view === null) throw new Error('plan did not open');
    const { brief, profile } = opened.plan.view.current;
    expect(profile).toBe('celebration');
    expect(Object.values(brief.functions)).toEqual([
      'unsure',
      'unsure',
      'unsure',
      'unsure',
      'unsure',
    ]);
  });
});

describe('showsFunctions', () => {
  const weights = DATA.budgetWeights;

  it('shows the rows while the occasion is open or asked', () => {
    expect(showsFunctions(emptyDraft(), weights, false)).toBe(true);
    expect(showsFunctions({ ...emptyDraft(), occasion: 'birthday' }, weights, true)).toBe(true);
  });

  it('hides them for a celebration whose functions are all Not sure', () => {
    expect(showsFunctions({ ...emptyDraft(), occasion: 'birthday' }, weights, false)).toBe(false);
  });

  it('keeps them when the reading answered a function, so the answer can be changed', () => {
    const draft = emptyDraft();
    const read = { ...draft, occasion: 'birthday' as const };
    const withMehndi = { ...read, functions: { ...read.functions, mehndi: 'yes' as const } };
    expect(showsFunctions(withMehndi, weights, false)).toBe(true);
  });
});
