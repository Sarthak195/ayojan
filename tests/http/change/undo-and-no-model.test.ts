import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PlanPageView } from '@/app/[lang]/p/[token]/_plan/plan-page-view';
import { POST as enter } from '@/app/[lang]/enter/[kind]/route';
import { POST as read } from '@/app/[lang]/read/[kind]/route';
import { POST as undo } from '@/app/[lang]/undo/route';

import { BRIEF_OP } from '../../fixtures/plan-readings';
import { seal } from '../support';
import {
  changeDeps,
  context,
  DATA,
  deps,
  EXPLAINER_REPLY,
  EXPLAINER_TEXT,
  location,
  opened,
  post,
  SPEC_OPS,
  specToken,
  stateOf,
  tokenAt,
} from './change-support';

function undoStep(token: string): Promise<Response> {
  return undo(post('/en/undo', { token }), context({ lang: 'en' }), deps());
}

async function changedToken(): Promise<string> {
  const response = await enter(
    post('/en/enter/change', {
      token: specToken(),
      guests: '250',
      budget: '750000',
      eventDate: '2027-02-12',
      moveAmount: '',
      moveTo: '',
      priorityVenue: '',
      priorityCatering: '',
      priorityDecor: '',
      priorityPhoto: '',
      priorityMusic: '',
      priorityInvites: '',
      priorityContingency: '',
    }),
    context({ lang: 'en', kind: 'change' }),
    deps(),
  );
  return tokenAt(response, '/revision');
}

describe('POST /[lang]/undo (FR-29)', () => {
  it('drops the last step and returns exactly the previous plan', async () => {
    const response = await undoStep(await changedToken());
    expect(response.status).toBe(303);
    const token = tokenAt(response, '');
    // Payloads, not ciphertexts: the random IV makes every sealed link different.
    expect(stateOf(token)).toEqual({ schema: 1, ops: SPEC_OPS });
    expect(opened(token).view).toEqual(opened(specToken()).view);
  });

  it('drops a pending reading along with the step it was read against', async () => {
    const { deps: readDeps } = changeDeps({ reading: EXPLAINER_REPLY });
    const checked = await read(
      post('/en/read/change', { token: specToken(), change: EXPLAINER_TEXT }),
      context({ lang: 'en', kind: 'change' }),
      readDeps,
    );
    const token = tokenAt(await undoStep(tokenAt(checked, '/check')), '');
    expect(stateOf(token)).toEqual({ schema: 1, ops: SPEC_OPS.slice(0, -1) });
  });

  it('answers 422 "nothing to undo" when only the brief is left', async () => {
    const response = await undoStep(seal({ schema: 1, ops: [BRIEF_OP] }));
    expect(response.status).toBe(422);
    expect(await response.text()).toMatch(/undo/i);
  });

  it('answers 400 for a damaged link', async () => {
    expect((await undoStep('not-a-real-token')).status).toBe(400);
  });
});

describe('the no-model path for a change (FR-40, G3)', () => {
  it.each(['quota', 'timeout', 'nokey'] as const)(
    'a %s failure returns to the plan with its change form open and the plan unchanged',
    async (reply) => {
      const token = specToken();
      const { gateway, deps: readDeps } = changeDeps(reply);
      const response = await read(
        post('/en/read/change', { token, change: EXPLAINER_TEXT }),
        context({ lang: 'en', kind: 'change' }),
        readDeps,
      );
      expect(response.status).toBe(303);
      expect(location(response)).toBe(`/en/p/${token}?ai=unavailable&why=${reply}#change-form`);
      expect(gateway.calls).toHaveLength(1);
    },
  );

  it('shows the reason above the open change form, whose twin needs no model', () => {
    const token = specToken();
    const html = renderToStaticMarkup(
      createElement(PlanPageView, {
        lang: 'en',
        token,
        view: opened(token).view,
        weights: DATA.budgetWeights,
        changeUnavailable: 'quota',
      }),
    );
    expect(html).toContain('id="change-form"');
    expect(html).toContain('The AI reader is unavailable right now (the daily quota is used up)');
    expect(html).toMatch(/<details[^>]*open=""/);
    const formSummary =
      /<summary[^>]*>Use the form instead[\s\S]*?<\/summary>/.exec(html)?.[0] ?? '';
    expect(formSummary).toContain('underline');
    expect(formSummary).toContain('<svg');
    expect(html).toContain('action="/en/enter/change"');
    expect(html).toContain('action="/en/read/change"');
    expect(html).toContain('Reading can take up to 40 seconds.');
    expect(html).toContain('action="/en/undo"');
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it('keeps the change form closed when the reader is fine', () => {
    const token = specToken();
    const html = renderToStaticMarkup(
      createElement(PlanPageView, {
        lang: 'en',
        token,
        view: opened(token).view,
        weights: DATA.budgetWeights,
      }),
    );
    expect(html).not.toMatch(/<details[^>]*open=""/);
    expect(html).not.toContain('The AI reader is unavailable');
  });
});
