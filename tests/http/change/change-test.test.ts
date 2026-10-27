import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { categoryLabels } from '@/app/[lang]/p/[token]/_change/category-labels';
import { ChangeCheckView } from '@/app/[lang]/p/[token]/_change/change-check-view';
import { RevisionView } from '@/app/[lang]/p/[token]/_revision/revision-view';
import { POST as confirm } from '@/app/[lang]/confirm/route';
import { POST as read } from '@/app/[lang]/read/[kind]/route';
import type { Lang } from '@/i18n/lang';

import {
  changeDeps,
  context,
  DATA,
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

async function readExplainer(): Promise<string> {
  const { gateway, deps: readDeps } = changeDeps({ reading: EXPLAINER_REPLY });
  const response = await read(
    post('/en/read/change', { token: specToken(), change: EXPLAINER_TEXT }),
    context({ lang: 'en', kind: 'change' }),
    readDeps,
  );
  expect(response.status).toBe(303);
  expect(gateway.calls.map((call) => call.promptId)).toEqual(['change']);
  return tokenAt(response, '/check');
}

function checkHtml(token: string, lang: Lang = 'en'): string {
  const { view, plan } = opened(token);
  const { pending } = plan.state;
  if (pending?.kind !== 'change') throw new Error('no pending change');
  return renderToStaticMarkup(
    createElement(ChangeCheckView, {
      lang,
      token,
      pending,
      current: headlineOf(view),
      today: TODAY,
      labelOf: categoryLabels(DATA.budgetWeights, view.current.profile, lang),
      recordedOn: null,
    }),
  );
}

function revisionHtml(token: string, lang: Lang = 'en'): string {
  const { view } = opened(token);
  return renderToStaticMarkup(createElement(RevisionView, { lang, token, view, data: DATA }));
}

async function applyWith(checkToken: string, fields: Record<string, string>): Promise<Response> {
  return confirm(
    post('/en/confirm', { token: checkToken, intent: 'confirm', ...fields }),
    context({ lang: 'en' }),
    deps(),
  );
}

describe('the change test through HTTP (spec 5.2, FR-23 to FR-27)', () => {
  it('reads the explainer sentence into a pending change, without adding an op', async () => {
    const state = stateOf(await readExplainer());
    expect(state.ops).toEqual(SPEC_OPS);
    expect(state.pending?.kind).toBe('change');
    if (state.pending?.kind !== 'change') return;
    const { values, readBy } = state.pending;
    expect(values.guests).toEqual({ mode: 'delta', count: 50 });
    expect(values.budget).toEqual({
      mode: 'directionOnly',
      direction: 'decrease',
      amountInr: null,
    });
    // Two weeks before 26 Feb 2027, computed in code from the plan's date.
    expect(values.dateCandidates).toEqual(['2027-02-12']);
    expect(readBy.source).toBe('ai');
  });

  it('shows the reading and asks "By how much?" with nothing chosen', async () => {
    const html = checkHtml(await readExplainer());
    expect(html.match(/<h1/g)).toHaveLength(1);
    // The 303 fragment lands on the heading, so focus starts on the summary.
    expect(/<h1[^>]*>/.exec(html)?.[0]).toMatch(/id="check-summary"[^>]*tabindex="-1"/);
    expect(html).toContain('+50, so 250 guests');
    expect(html).toContain('Moves to 12 Feb 2027');
    expect(html).toContain('2 weeks earlier');
    expect(html).toContain('Budget decreased: by how much?');
    expect(html).toContain('Rs 7,60,000');
    expect(html).toContain('Rs 7,20,000');
    expect(html).toContain('An exact amount');
    for (const value of ['percent5', 'percent10', 'exact']) {
      expect(html).toMatch(new RegExp(`<input[^>]*value="${value}"`));
    }
    expect(html).not.toMatch(/name="budgetChoice"[^>]*checked/);
    expect(html).not.toMatch(/checked=""[^>]*name="budgetChoice"/);
    expect(html).toContain('Apply this change');
  });

  it('refuses to apply while "By how much?" is unanswered, adding no op', async () => {
    const checkToken = await readExplainer();
    const response = await applyWith(checkToken, {});
    const state = stateOf(tokenAt(response, '/check'));
    expect(state.ops).toEqual(SPEC_OPS);
    expect(state.pending?.kind).toBe('change');
  });

  it('applies the answered change as one op and lands on the revision page', async () => {
    const response = await applyWith(await readExplainer(), {
      budgetChoice: 'exact',
      budgetExact: '7,50,000',
    });
    const token = tokenAt(response, '/revision');
    const state = stateOf(token);
    expect(state.pending).toBeUndefined();
    expect(state.ops.slice(0, -1)).toEqual(SPEC_OPS);
    const op = state.ops.at(-1);
    expect(op).toMatchObject({
      kind: 'changeConfirmed',
      guests: 250,
      budgetInr: 750_000,
      eventDate: '2027-02-12',
      reallocate: null,
      priorities: null,
    });
    if (op?.kind !== 'changeConfirmed') return;
    expect(op.sources).toContain('2 weeks earlier');
    expect(op.readBy.source).toBe('ai');
    const { headline } = opened(token).view.current;
    expect([headline.guests, headline.budget.inr, headline.eventDate]).toEqual([
      250,
      750_000,
      '2027-02-12',
    ]);
  });

  it('takes an offered percentage as the answer', async () => {
    const response = await applyWith(await readExplainer(), { budgetChoice: 'percent5' });
    const op = stateOf(tokenAt(response, '/revision')).ops.at(-1);
    expect(op).toMatchObject({ kind: 'changeConfirmed', budgetInr: 760_000 });
  });

  it('shows the diff, the counter, both Kept lists and the vendors to ask again', async () => {
    const response = await applyWith(await readExplainer(), {
      budgetChoice: 'exact',
      budgetExact: '750000',
    });
    const token = tokenAt(response, '/revision');
    const { view } = opened(token);
    const revision = view.revision;
    if (revision === null) throw new Error('no revision');
    const html = revisionHtml(token);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('What changed in v6');
    const { kept, total } = revision.kept.counter;
    expect(html).toContain(
      `Revised, not restarted: ${String(kept)} of ${String(total)} decisions kept.`,
    );
    expect(kept).toBe(revision.kept.kept.length + revision.kept.keptAskAgain.length);
    expect(html).toContain('role="status"');
    expect(html).toContain('Change applied: plan v6');
    // The diff table: a captioned, focusable region with row headers.
    expect(html).toMatch(/role="region" tabindex="0" aria-labelledby="diff-table-caption"/i);
    expect(html).toContain('Plan v5 against v6');
    expect(html).toContain('26 Feb 2027');
    expect(html).toContain('12 Feb 2027');
    expect(html).toContain('Rs 8,00,000');
    expect(html).toContain('Rs 7,50,000');
    expect(html).toContain('No: 250 &gt; 220');
    expect(html).toContain('Caterer B cheaper');
    // Its slack drops as the date moves earlier; the name comes from the data, which may be reworded.
    const caterer = DATA.tasks.tasks.find((row) => row.id === 'book-caterer');
    expect(html).toContain(`>${caterer?.en ?? 'book-caterer'}<`);
    // Kept, and Kept, ask again: the venue booking and both quotes are asked again.
    expect(html).toContain('>Kept<');
    expect(html).toContain('Kept, ask again');
    expect(html).toContain('Must-have: Dhol');
    expect(html).toContain('Quote from Caterer A');
    expect(html).toContain('Quote from Caterer B');
    expect(html).toContain('Needs re-confirmation');
    expect(html).toContain('Undo last step');
    expect(html).toContain('action="/en/undo"');
  });

  it('renders the revision page in Hindi with one h1 and the same counter numbers', async () => {
    const response = await applyWith(await readExplainer(), {
      budgetChoice: 'exact',
      budgetExact: '750000',
    });
    const token = tokenAt(response, '/revision');
    const html = revisionHtml(token, 'hi');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('संशोधित, नए सिरे से नहीं');
    expect(html).toContain('action="/hi/undo"');
  });
});
