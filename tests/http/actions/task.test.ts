import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { POST as task } from '@/app/[lang]/task/route';
import { PlanPageView } from '@/app/[lang]/p/[token]/_plan/plan-page-view';

import type { Op } from '@/schemas/plan/op';

import { AI_READ, HINGLISH_BRIEF } from '../../fixtures/plan-readings';
import { context, DATA, deps, post, type Fields } from '../support';
import { BRIEF_TOKEN, opsOf, planLocation, tokenFor, viewOf } from './actions-support';

const EN = context({ lang: 'en' });

function send(fields: Fields, lang: 'en' | 'hi' = 'en'): Promise<Response> {
  return task(post(`/${lang}/task`, fields), context({ lang }), deps());
}

function planHtml(token: string, latestDelay: string | null): string {
  const ops = opsOf(token);
  // React separates adjacent text with empty comments; they are not part of what is read out.
  const html = renderToStaticMarkup(
    createElement(PlanPageView, {
      lang: 'en',
      token,
      view: viewOf(ops),
      weights: DATA.budgetWeights,
      latestDelay,
    }),
  );
  return html.replaceAll('<!-- -->', '');
}

describe('POST /[lang]/task', () => {
  it('marks a booking task done with its amount and capacity, and lands on #tasks', async () => {
    const response = await send({
      token: BRIEF_TOKEN,
      taskId: 'book-venue',
      event: 'done',
      amountInr: '180000',
      capacity: '220',
    });
    expect(response.status).toBe(303);
    const where = planLocation(response);
    expect([where.page, where.anchor]).toEqual(['', '#tasks']);
    expect(opsOf(where.token).at(-1)).toEqual({
      kind: 'taskDone',
      taskId: 'book-venue',
      on: '2026-10-31',
      amountInr: 180_000,
      capacity: 220,
    });
    const venue = viewOf(opsOf(where.token)).current.money.projection.lines.venue;
    expect(venue.projected).toEqual({ inr: 180_000, provenance: 'your-number' });
  });

  it('marks a task done without an amount, leaving its category projected', async () => {
    const response = await send({ token: BRIEF_TOKEN, taskId: 'book-caterer', event: 'done' });
    const ops = opsOf(planLocation(response).token);
    expect(ops.at(-1)).toMatchObject({ kind: 'taskDone', amountInr: null, capacity: null });
    expect(viewOf(ops).current.money.projection.lines.catering.held.booked).toBe(false);
  });

  it('stores a delay as an absolute date and names the dependants it moved (D11)', async () => {
    // Spec 5.6: the venue is booked first, so only the delay holds the decorator back.
    const booked = await send({ token: BRIEF_TOKEN, taskId: 'book-venue', event: 'done' });
    const response = await send({
      token: planLocation(booked).token,
      taskId: 'book-decorator',
      event: 'delayed',
      days: '10',
    });
    expect(response.status).toBe(303);
    const { token } = planLocation(response);
    expect(opsOf(token).at(-1)).toEqual({
      kind: 'taskDelayed',
      taskId: 'book-decorator',
      notBefore: '2026-11-10',
    });
    const effect = viewOf(opsOf(token)).current.delayEffects.find(
      (each) => each.delayedTaskId === 'book-decorator',
    );
    expect(effect?.dependants.map((each) => each.taskId)).toEqual([
      'decor-sign-off',
      'mandap-design',
      'final-walkthrough',
    ]);
    // Names come from data/tasks.yaml, which another review may reword.
    const { schedule } = viewOf(opsOf(token)).current;
    const name = (id: string): string => schedule.tasks.find((each) => each.id === id)?.en ?? id;
    const moved = ['decor-sign-off', 'mandap-design', 'final-walkthrough'].map(name).join(', ');
    const html = planHtml(token, 'book-decorator');
    const summary = /role="status"[^>]*>([^<]*)</.exec(html)?.[1] ?? '';
    expect(summary).toContain(`${name('book-decorator')} delayed`);
    expect(summary).toContain(`Moved later: ${moved}.`);
    expect(html).toContain(`moved 10 days later because ${name('book-decorator')} was delayed`);
  });

  it('renders Mark done and Delayed by controls for open tasks only', () => {
    const html = planHtml(BRIEF_TOKEN, null);
    expect(html).toContain('action="/en/task"');
    expect(html).toMatch(/name="amountInr"/);
    expect(html).toMatch(/name="capacity"/);
    // The booking tasks' Mark done is a summary styled as the outlined button, with a marker.
    const summary =
      /<summary[^>]*>\s*<span aria-hidden="true">Mark done[\s\S]*?<\/summary>/.exec(html)?.[0] ??
      '';
    expect(summary).toContain('border border-foreground');
    expect(summary).toContain('min-h-11');
    expect(summary).toContain('<svg');
    const days = /<input[^>]*name="days"[^>]*>/.exec(html)?.[0] ?? '';
    expect(days).toContain('min="1"');
    expect(days).toContain('max="60"');
    expect(days).toContain('required');
  });

  it('names the task inside every Done and Save button, so the 14 of each differ', () => {
    const html = planHtml(BRIEF_TOKEN, null);
    const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map(
      (match) => match[1] ?? '',
    );
    for (const label of ['Mark done', 'Save']) {
      const named = buttons.filter((text) => text.startsWith(`<span aria-hidden="true">${label}<`));
      expect(named.length).toBeGreaterThan(1);
      // The whole name in one node: a separate ": task" span gets a space before its colon.
      for (const text of named)
        expect(text).toMatch(new RegExp(`<span class="sr-only">${label}: [^<]+</span>$`));
      expect(new Set(named.map((text) => text.replace(/<[^>]+>/g, ''))).size).toBe(named.length);
    }
  });

  it('names a category in the task form as the money table does, by the plan profile', () => {
    const birthday: Op = {
      kind: 'briefConfirmed',
      brief: { ...HINGLISH_BRIEF, occasion: 'birthday' },
      readBy: AI_READ,
    };
    const html = planHtml(tokenFor([birthday]), null);
    expect(html).toContain('With an amount, Venue or hall shows as booked');
    expect(html).toContain('With an amount, Food and drinks shows as booked');
    expect(html).not.toContain('With an amount, Food and catering');
  });

  it('links the change box, quotes, trade-offs and messages from the Jump to nav', () => {
    const html = planHtml(BRIEF_TOKEN, null);
    const nav = /<nav[^>]*>[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';
    expect(nav).toMatch(/href="#change-form"[^>]*>What changed\?/);
    expect(nav).toContain(`href="/en/p/${BRIEF_TOKEN}/quotes"`);
    expect(nav).toContain(`href="/en/p/${BRIEF_TOKEN}/revision#levers"`);
    expect(nav).toContain(`href="/en/p/${BRIEF_TOKEN}/messages"`);
  });

  it.each(['0', '61', '2.5', 'ten'])('refuses a delay of %s days with a 400', async (days) => {
    const response = await send({
      token: BRIEF_TOKEN,
      taskId: 'book-decorator',
      event: 'delayed',
      days,
    });
    expect(response.status).toBe(400);
  });

  it.each([
    ['an unknown task', { taskId: 'book-elephant', event: 'done' }],
    [
      'an amount on a task that books nothing',
      { taskId: 'decor-sign-off', event: 'done', amountInr: '5000' },
    ],
    [
      'a capacity on a task that is not the venue',
      { taskId: 'book-caterer', event: 'done', capacity: '200' },
    ],
  ])('answers 422 for %s, never a 500', async (_, fields) => {
    const response = await send({ token: BRIEF_TOKEN, ...fields });
    expect(response.status).toBe(422);
  });

  it('refuses a delay on a task already done', async () => {
    const done = await send({ token: BRIEF_TOKEN, taskId: 'book-venue', event: 'done' });
    const { token } = planLocation(done);
    const response = await send({ token, taskId: 'book-venue', event: 'delayed', days: '5' });
    expect(response.status).toBe(422);
  });

  it('answers 400 for a damaged token and 404 for an unknown language', async () => {
    const damaged = await send({ token: 'abc', taskId: 'book-venue', event: 'done' });
    expect(damaged.status).toBe(400);
    const french = await task(
      post('/fr/task', { token: BRIEF_TOKEN, taskId: 'book-venue', event: 'done' }),
      context({ lang: 'fr' }),
      deps(),
    );
    expect(french.status).toBe(404);
  });

  it('refuses a JSON body with a 415', async () => {
    const response = await task(
      post('/en/task', { token: BRIEF_TOKEN }, 'application/json'),
      EN,
      deps(),
    );
    expect(response.status).toBe(415);
  });
});
