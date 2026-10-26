import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import StartPage from '@/app/[lang]/page';
import { POST as enter } from '@/app/[lang]/enter/[kind]/route';
import { PlanPageView } from '@/app/[lang]/p/[token]/_plan/plan-page-view';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import { openPlan } from '@/server/view/plan-page';

import { expectReadButtonHint } from './hint-assert';
import { context, DATA, deps, digestOf, HINGLISH_FORM, post, sources, tokenOf } from './support';

async function planHtml(lang: Lang): Promise<string> {
  const response = await enter(
    post(`/${lang}/enter/brief`, HINGLISH_FORM),
    context({ lang, kind: 'brief' }),
    deps(),
  );
  const token = tokenOf(response);
  const opened = openPlan(token, sources());
  if (!opened.ok || opened.plan.view === null) throw new Error('plan did not open');
  return renderToStaticMarkup(
    createElement(PlanPageView, {
      lang,
      token,
      view: opened.plan.view,
      weights: DATA.budgetWeights,
    }),
  );
}

const LABELS = (lang: Lang): string[] => {
  const words = dictionaryFor(lang).common.provenance;
  return [words.yourNumber, words.yourSplit, words.fromAQuote, words.computed, words.assumption];
};

describe('GET /[lang] (start page)', () => {
  it('offers the brief box, the 40-second hint, the form and the example', async () => {
    const html = renderToStaticMarkup(await StartPage({ params: Promise.resolve({ lang: 'en' }) }));
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<textarea[^>]*name="brief"[^>]*maxLength="2000"/);
    expect(html).toContain('action="/en/read/brief"');
    expect(html).toContain('Reading can take up to 40 seconds.');
    expect(html).toContain('href="/en/form"');
    expect(html).toContain('If the AI reader is busy, use the form instead');
    expect(html).toContain('Try the example brief');
    // The sample rides in a hidden field of its own form; the text box stays empty.
    expect(html).toMatch(/<input type="hidden" name="brief" value="Bhai ki shaadi/);
    expect(html).toMatch(/<textarea[^>]*name="brief"[^>]*><\/textarea>/);
  });

  it.each(['en', 'hi'] as const)(
    'points the read and example buttons at hints that hold the privacy line (%s)',
    async (lang) => {
      const html = renderToStaticMarkup(await StartPage({ params: Promise.resolve({ lang }) }));
      expectReadButtonHint(html, lang, 'read-hint');
      expectReadButtonHint(html, lang, 'example-hint');
    },
  );

  it('is a 404 for an unknown language', async () => {
    const digest = await digestOf(() => StartPage({ params: Promise.resolve({ lang: 'fr' }) }));
    expect(digest).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});

describe('GET /[lang]/p/[token] (plan page)', () => {
  it.each(['en', 'hi'] as const)(
    'points the change box button at a hint that holds the privacy line (%s)',
    async (lang) => {
      expectReadButtonHint(await planHtml(lang), lang, 'change-reading-hint');
    },
  );

  it('has one h1 naming the version, the occasion and the date', async () => {
    const html = await planHtml('en');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('Plan v1: Wedding, 26 Feb 2027');
    expect(html).toContain('Entered by form.');
    expect(html).toContain('role="status"');
  });

  it.each(['en', 'hi'] as const)(
    'labels every rupee amount in the money table (%s)',
    async (lang) => {
      const html = await planHtml(lang);
      const cells = html.match(/<td[^>]*>.*?<\/td>/g) ?? [];
      const money = cells.filter((cell) => cell.includes('Rs '));
      expect(money.length).toBeGreaterThan(7);
      for (const cell of money) {
        expect(
          LABELS(lang).some((label) => cell.includes(label)),
          cell,
        ).toBe(true);
      }
      expect(html).toContain('Rs 8,00,000');
    },
  );

  it('names each category in the page language in Why these numbers, with no doubled colon', async () => {
    const html = await planHtml('hi');
    const why = /<details[\s\S]*?ये आँकड़े क्यों\?[\s\S]*?<\/details>/.exec(html)?.[0] ?? '';
    expect(why).toContain('<span lang="hi" class="font-medium">खाना-पीना</span>');
    expect(why).not.toContain('>Catering<');
    expect(html).not.toContain('::');
  });

  it('shows the timeline with a status word and an icon for every task', async () => {
    const html = await planHtml('en');
    const tasks = /<section id="tasks"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    const items = tasks.match(/<li/g) ?? [];
    expect(items.length).toBeGreaterThan(3);
    expect((tasks.match(/<svg/g) ?? []).length).toBe(items.length);
    expect(tasks).toMatch(/On track|Due this week|At risk|Late|Done/);
  });

  it('links on to quotes, the revision and messages, and keeps the noted items', async () => {
    const html = await planHtml('en');
    expect(html).toMatch(/href="\/en\/p\/[A-Za-z0-9_-]+\/quotes"/);
    expect(html).toMatch(/href="\/en\/p\/[A-Za-z0-9_-]+\/revision"/);
    expect(html).toMatch(/href="\/en\/p\/[A-Za-z0-9_-]+\/messages"/);
    expect(html).toContain('id="ledger"');
  });
});
