import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { categoryLabels } from '@/app/[lang]/p/[token]/_change/category-labels';
import { ChangeCheckView } from '@/app/[lang]/p/[token]/_change/change-check-view';
import { POST as confirm } from '@/app/[lang]/confirm/route';
import { POST as enter } from '@/app/[lang]/enter/[kind]/route';
import { POST as read } from '@/app/[lang]/read/[kind]/route';

import {
  changeDeps,
  context,
  DATA,
  DATE_CONFLICT_REPLY,
  DATE_CONFLICT_TEXT,
  deps,
  EXPLAINER_REPLY,
  EXPLAINER_TEXT,
  headlineOf,
  opened,
  post,
  SPEC_OPS,
  specToken,
  stateOf,
  TODAY,
  tokenAt,
} from './change-support';

// Every change form field, left as a browser sends an untouched form: text empty, radios on
// their "No change" choice.
const UNTOUCHED: Readonly<Record<string, string>> = {
  guests: '',
  budget: '',
  eventDate: '',
  moveAmount: '',
  moveTo: '',
  priorityVenue: '',
  priorityCatering: '',
  priorityDecor: '',
  priorityPhoto: '',
  priorityMusic: '',
  priorityInvites: '',
  priorityContingency: '',
};

function enterChange(fields: Readonly<Record<string, string>>): Promise<Response> {
  return enter(
    post('/en/enter/change', { token: specToken(), ...UNTOUCHED, ...fields }),
    context({ lang: 'en', kind: 'change' }),
    deps(),
  );
}

async function modelPathToken(): Promise<string> {
  const { deps: readDeps } = changeDeps({ reading: EXPLAINER_REPLY });
  const checked = await read(
    post('/en/read/change', { token: specToken(), change: EXPLAINER_TEXT }),
    context({ lang: 'en', kind: 'change' }),
    readDeps,
  );
  const applied = await confirm(
    post('/en/confirm', {
      token: tokenAt(checked, '/check'),
      intent: 'confirm',
      budgetChoice: 'exact',
      budgetExact: '750000',
    }),
    context({ lang: 'en' }),
    deps(),
  );
  return tokenAt(applied, '/revision');
}

function checkHtml(token: string): string {
  const { view, plan } = opened(token);
  const { pending } = plan.state;
  if (pending?.kind !== 'change') throw new Error('no pending change');
  return renderToStaticMarkup(
    createElement(ChangeCheckView, {
      lang: 'en',
      token,
      pending,
      current: headlineOf(view),
      today: TODAY,
      labelOf: categoryLabels(DATA.budgetWeights, view.current.profile, 'en'),
      recordedOn: null,
    }),
  );
}

describe('the change form twin (FR-30)', () => {
  it('gives the same plan as the model path, apart from how it was read', async () => {
    const response = await enterChange({
      guests: '250',
      budget: '7.5 lakh',
      eventDate: '2027-02-12',
    });
    const formView = opened(tokenAt(response, '/revision')).view;
    const modelView = opened(await modelPathToken()).view;
    const op = stateOf(tokenAt(response, '/revision')).ops.at(-1);
    expect(op).toMatchObject({ kind: 'changeConfirmed', priorities: null, sources: [] });
    if (op?.kind !== 'changeConfirmed') return;
    expect(op.readBy.source).toBe('form');
    expect(formView.current.headline).toEqual(modelView.current.headline);
    expect(formView.current.money.projection).toEqual(modelView.current.money.projection);
    expect(formView.current.schedule).toEqual(modelView.current.schedule);
    expect(formView.reconfirmations).toEqual(modelView.reconfirmations);
    expect(formView.revision?.kept.counter).toEqual(modelView.revision?.kept.counter);
  });

  it('changes a priority and moves money without touching the split (D13, D12)', async () => {
    const response = await enterChange({
      priorityCatering: 'standard',
      moveAmount: '40,000',
      moveTo: 'photo',
    });
    const token = tokenAt(response, '/revision');
    const op = stateOf(token).ops.at(-1);
    expect(op).toMatchObject({
      kind: 'changeConfirmed',
      guests: null,
      budgetInr: null,
      eventDate: null,
      reallocate: { to: 'photo', amountInr: 40_000 },
    });
    if (op?.kind !== 'changeConfirmed' || op.priorities === null) throw new Error('no priorities');
    const before = opened(specToken()).view.current.priorities;
    expect(op.priorities).toEqual({ ...before, catering: 'standard' });
    const { revision } = opened(token).view;
    expect(revision?.rows.some((row) => row.kind === 'reallocation')).toBe(true);
    expect(revision?.kept.changed.map((item) => item.key)).toContain('priority:catering');
  });

  it('applies a priority-only change, which the questions alone call empty', async () => {
    const response = await enterChange({ priorityDecor: 'more' });
    const op = stateOf(tokenAt(response, '/revision')).ops.at(-1);
    expect(op).toMatchObject({ kind: 'changeConfirmed', guests: null, reallocate: null });
  });

  it('sends a value outside the bounds to the check page as a question, with no op', async () => {
    const response = await enterChange({ guests: '0' });
    const token = tokenAt(response, '/check');
    const state = stateOf(token);
    expect(state.ops).toEqual(SPEC_OPS);
    expect(state.pending).toMatchObject({ kind: 'change', readBy: { source: 'form' } });
    const html = checkHtml(token);
    expect(html).toContain('That makes 0 guests. Please give a count from 1 to 5,000.');
    expect(html).not.toContain('Apply this change');
    expect(html).toContain('value="cancel"');
  });

  it('refuses a typed value that is not one number (400), and an empty form is a question', async () => {
    expect((await enterChange({ guests: 'abc' })).status).toBe(400);
    const empty = await enterChange({});
    expect(checkHtml(tokenAt(empty, '/check'))).toContain('We found nothing to change');
  });
});

describe('disagreeing dates (FR-24)', () => {
  it('asks which date with both offered and none chosen, then applies the pick', async () => {
    const { deps: readDeps } = changeDeps({ reading: DATE_CONFLICT_REPLY });
    const checked = await read(
      post('/en/read/change', { token: specToken(), change: DATE_CONFLICT_TEXT }),
      context({ lang: 'en', kind: 'change' }),
      readDeps,
    );
    const checkToken = tokenAt(checked, '/check');
    const html = checkHtml(checkToken);
    expect(html).toContain('Which date?');
    expect(html).toContain('12 Feb 2027 (the move you described)');
    expect(html).toContain('5 Mar 2027 (the date you wrote)');
    expect(html).not.toMatch(/name="dateChoice"[^>]*checked/);
    const applied = await confirm(
      post('/en/confirm', { token: checkToken, intent: 'confirm', dateChoice: 'written' }),
      context({ lang: 'en' }),
      deps(),
    );
    const op = stateOf(tokenAt(applied, '/revision')).ops.at(-1);
    expect(op).toMatchObject({ kind: 'changeConfirmed', eventDate: '2027-03-05' });
  });
});
