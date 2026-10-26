import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { POST as levers } from '@/app/[lang]/levers/route';
import { runningTable } from '@/app/[lang]/p/[token]/revision/_levers/lever-model';
import { LeverSection, selectionOf } from '@/app/[lang]/p/[token]/revision/_levers/lever-section';
import type { Op } from '@/schemas/plan/op';
import { openPlan } from '@/server/view/plan-page';

import { context, DATA, deps, location, post, sources, TODAY, type Fields } from '../support';
import {
  BRIEF_TOKEN,
  opsOf,
  OVER_BUDGET_OPS,
  OVER_BUDGET_TOKEN,
  planLocation,
} from './actions-support';

const EN = context({ lang: 'en' });

function send(fields: Fields): Promise<Response> {
  return levers(post('/en/levers', fields), EN, deps());
}

function sectionHtml(token: string, query: Record<string, string> = {}): string {
  const opened = openPlan(token, sources());
  if (!opened.ok || opened.plan.view === null) throw new Error('plan did not open');
  const html = renderToStaticMarkup(
    createElement(LeverSection, {
      lang: 'en',
      token,
      view: opened.plan.view,
      ops: opened.plan.state.ops,
      data: DATA,
      today: TODAY,
      selection: selectionOf(query),
    }),
  );
  return html.replaceAll('<!-- -->', '');
}

function runningLine(html: string): string {
  return /id="running-line"[^>]*>([^<]*)</.exec(html)?.[1] ?? '';
}

function lastOp(response: Response): Op | undefined {
  return opsOf(planLocation(response).token).at(-1);
}

const BOTH = ['e-invites', 'half-contingency'];

describe('GET the trade-offs (spec 6.6, FR-31)', () => {
  it('lists every lever with its saving and label, refused food and disabled band', () => {
    const html = sectionHtml(OVER_BUDGET_TOKEN);
    for (const lever of DATA.levers.levers) expect(html).toContain(`value="${lever.id}"`);
    expect(html).toMatch(/id="lever-smaller-band"[^>]*disabled/);
    expect(html).toContain('Not available: you said');
    expect(html).toContain('is your priority, so this is not suggested.');
    expect(html).toContain('name="showAnyway" value="simpler-menu"');
    expect(html).toContain('Rs 54,000');
    expect(html).toContain('Planning assumption: about 15 percent');
    expect(html).toContain('Reserve left');
    expect(html).not.toContain('checked=""');
    expect(runningLine(html)).toBe('Selected saves Rs 0; now Rs 1,57,000 over budget');
  });

  it('says there is nothing to trade off within budget, and refuses any lever post', async () => {
    expect(sectionHtml(BRIEF_TOKEN)).toContain('nothing to trade off');
    const response = await send({ token: BRIEF_TOKEN, intent: 'preview', lever: ['e-invites'] });
    expect(response.status).toBe(422);
  });
});

describe('POST /[lang]/levers intent=preview (Recalculate without JavaScript)', () => {
  it('303s to the trade-offs with the ids only, and the page shows the server total', async () => {
    const response = await send({ token: OVER_BUDGET_TOKEN, intent: 'preview', lever: BOTH });
    expect(response.status).toBe(303);
    const where = planLocation(response);
    expect([where.token, where.page, where.query]).toEqual([
      OVER_BUDGET_TOKEN,
      '/revision',
      '?sel=e-invites,half-contingency',
    ]);
    const html = sectionHtml(where.token, { sel: 'e-invites,half-contingency' });
    expect(runningLine(html)).toBe('Selected saves Rs 59,200; now Rs 97,800 over budget');
    expect(html).toMatch(/id="running-line"[^>]*>[^<]*<\/p><span[^>]*>Computed<\/span>/);
    expect(html).toMatch(/id="lever-e-invites"[^>]*checked/);
    expect(html).toContain('Preview: nothing is applied yet.');
  });

  it('gives the island the same sentence the fold gives (the client adds nothing up)', () => {
    const opened = openPlan(OVER_BUDGET_TOKEN, sources());
    if (!opened.ok || opened.plan.view === null) throw new Error('plan did not open');
    const table = runningTable(opened.plan.view.current, DATA, 'en');
    expect(table?.['e-invites,half-contingency']).toBe(
      'Selected saves Rs 59,200; now Rs 97,800 over budget',
    );
    expect(Object.keys(table ?? {})).toHaveLength(2 ** 6);
  });

  it('refuses the food lever without "Show anyway" and the band lever always (422)', async () => {
    const food = await send({
      token: OVER_BUDGET_TOKEN,
      intent: 'preview',
      lever: ['simpler-menu'],
    });
    expect(food.status).toBe(422);
    const band = await send({ token: OVER_BUDGET_TOKEN, intent: 'apply', lever: ['smaller-band'] });
    expect(band.status).toBe(422);
    const shown = await send({
      token: OVER_BUDGET_TOKEN,
      intent: 'preview',
      lever: ['simpler-menu'],
      showAnyway: ['simpler-menu'],
    });
    expect(location(shown)).toMatch(/\/revision\?sel=simpler-menu$/);
  });

  it('ignores a hand-edited selection it cannot use instead of failing', () => {
    const html = sectionHtml(OVER_BUDGET_TOKEN, { sel: 'smaller-band' });
    expect(runningLine(html)).toBe('Selected saves Rs 0; now Rs 1,57,000 over budget');
  });
});

describe('POST /[lang]/levers intent=apply', () => {
  it('appends one leversApplied op and 303s to the plan', async () => {
    const response = await send({ token: OVER_BUDGET_TOKEN, intent: 'apply', lever: BOTH });
    expect(response.status).toBe(303);
    expect(planLocation(response).page).toBe('');
    expect(opsOf(planLocation(response).token)).toHaveLength(OVER_BUDGET_OPS.length + 1);
    expect(lastOp(response)).toEqual({
      kind: 'leversApplied',
      leverIds: BOTH,
      raiseBudgetInr: null,
    });
  });

  it('sends the raise with the rupees left after the other ticks', async () => {
    const alone = await send({
      token: OVER_BUDGET_TOKEN,
      intent: 'apply',
      lever: ['raise-budget'],
    });
    expect(lastOp(alone)).toMatchObject({ leverIds: ['raise-budget'], raiseBudgetInr: 157_000 });
    const four = ['simpler-decor', 'e-invites', 'leaner-photo', 'half-contingency'];
    const withFour = await send({
      token: OVER_BUDGET_TOKEN,
      intent: 'apply',
      lever: [...four, 'raise-budget'],
    });
    expect(lastOp(withFour)).toEqual({
      kind: 'leversApplied',
      leverIds: [...four, 'raise-budget'],
      raiseBudgetInr: 51_900,
    });
  });

  it('drops a ticked raise when the other ticks already close the gap', async () => {
    const all = ['simpler-decor', 'e-invites', 'leaner-photo', 'simpler-menu', 'half-contingency'];
    const response = await send({
      token: OVER_BUDGET_TOKEN,
      intent: 'apply',
      lever: [...all, 'raise-budget'],
      showAnyway: ['simpler-menu'],
    });
    expect(lastOp(response)).toEqual({
      kind: 'leversApplied',
      leverIds: all,
      raiseBudgetInr: null,
    });
  });

  it('does not send a lever already in force again, and lists it as chosen', async () => {
    const first = await send({ token: OVER_BUDGET_TOKEN, intent: 'apply', lever: ['e-invites'] });
    const { token } = planLocation(first);
    expect(sectionHtml(token)).toContain('Already chosen');
    expect(sectionHtml(token)).not.toContain('value="e-invites"');
    const second = await send({ token, intent: 'apply', lever: ['e-invites', 'simpler-decor'] });
    expect(lastOp(second)).toMatchObject({ leverIds: ['simpler-decor'] });
  });

  it('changes nothing for an empty Apply and goes back to the choices', async () => {
    const response = await send({ token: OVER_BUDGET_TOKEN, intent: 'apply' });
    expect(location(response)).toBe(`/en/p/${OVER_BUDGET_TOKEN}/revision`);
  });

  it('refuses an unknown intent or lever id as a 400', async () => {
    const intent = await send({ token: OVER_BUDGET_TOKEN, intent: 'auto', lever: BOTH });
    expect(intent.status).toBe(400);
    const id = await send({ token: OVER_BUDGET_TOKEN, intent: 'apply', lever: ['trim-guests'] });
    expect(id.status).toBe(400);
  });
});
