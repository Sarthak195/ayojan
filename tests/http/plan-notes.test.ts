import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { POST as enter } from '@/app/[lang]/enter/[kind]/route';
import { PlanPageView } from '@/app/[lang]/p/[token]/_plan/plan-page-view';
import { LeverRow } from '@/app/[lang]/p/[token]/revision/_levers/lever-row';
import type { LeverOption } from '@/core/levers/lever-types';
import { basisNote } from '@/i18n/basis-note';
import type { Lang } from '@/i18n/lang';
import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';
import { openPlan } from '@/server/view/plan-page';

import { context, DATA, deps, HINGLISH_FORM, post, sources, tokenOf } from './support';

// "Why these numbers?" and "Why this number?" show the data's note in the page's language,
// each tagged with the language it is written in, so a row with no Hindi yet reads as English.

async function planHtml(lang: Lang, weights: BudgetWeightsFile): Promise<string> {
  const response = await enter(
    post(`/${lang}/enter/brief`, HINGLISH_FORM),
    context({ lang, kind: 'brief' }),
    deps(),
  );
  const token = tokenOf(response);
  const opened = openPlan(token, sources());
  if (!opened.ok || opened.plan.view === null) throw new Error('plan did not open');
  return renderToStaticMarkup(
    createElement(PlanPageView, { lang, token, view: opened.plan.view, weights }),
  );
}

const whyList = (html: string): string =>
  /<details[\s\S]*?(?:ये आँकड़े क्यों|Why these numbers)\?[\s\S]*?<\/details>/.exec(html)?.[0] ??
  '';

/** The wedding weights with the venue's Hindi note removed, to exercise the fallback. */
function weightsWithoutVenueHindi(): BudgetWeightsFile {
  const weights = structuredClone(DATA.budgetWeights);
  const venue = weights.profiles
    .find((profile) => profile.id === 'wedding')
    ?.categories.find((row) => row.category === 'venue');
  if (venue === undefined) throw new Error('fixture needs the wedding venue');
  delete venue.basisHi;
  return weights;
}

const wedding = DATA.budgetWeights.profiles.find((profile) => profile.id === 'wedding');
const categoryOf = (category: string) => wedding?.categories.find((r) => r.category === category);

describe('basis notes on the plan page', () => {
  it('shows the Hindi note with lang="hi" on a Hindi page, and English with lang="en" where none is written', async () => {
    const why = whyList(await planHtml('hi', weightsWithoutVenueHindi()));
    const catering = categoryOf('catering')?.basisHi ?? 'missing';
    const venue = categoryOf('venue')?.basis ?? 'missing';
    expect(why).toContain(`<span lang="hi">${catering}</span>`);
    expect(why).toContain(`<span lang="hi">${wedding?.basisHi ?? 'missing'}</span>`);
    expect(why).toContain(`<span lang="en">${venue}</span>`);
    expect(why).toContain('<ul lang="hi"');
  });

  it('keeps every note in English with lang="en" on an English page', async () => {
    const why = whyList(await planHtml('en', DATA.budgetWeights));
    expect(why).toContain(`<span lang="en">${categoryOf('catering')?.basis ?? 'missing'}</span>`);
    expect(why).not.toMatch(/[ऀ-ॿ]/);
  });
});

describe('basis note on a lever', () => {
  const row = DATA.levers.levers[0];
  if (row === undefined) throw new Error('fixture needs a lever');
  const option = (basisHi: string | null): LeverOption => ({
    id: row.id,
    effect: row.effect,
    label: { en: row.en, hi: row.hi },
    consequence: row.consequence,
    basis: row.basis,
    basisHi,
    category: 'decor',
    percent: 30,
    status: 'offered',
    reason: null,
    provenance: 'assumption',
    saving: { inr: 30_000, provenance: 'assumption' },
    bufferLeft: null,
    fasterAlternativeFor: null,
    showAnywayAllowed: false,
  });
  const render = (lang: Lang, basisHi: string | null): string =>
    renderToStaticMarkup(createElement(LeverRow, { option: option(basisHi), lang, ticked: false }));

  it('shows the Hindi note on a Hindi page and falls back to English when it is missing', () => {
    expect(render('hi', row.basisHi ?? null)).toContain(`<p lang="hi" class="text-sm text-muted">`);
    expect(render('hi', null)).toContain(`<p lang="en" class="text-sm text-muted">${row.basis}`);
    expect(render('en', row.basisHi ?? null)).toContain(`lang="en" class="text-sm text-muted">`);
  });

  it('picks the note by the page language, never Hindi on an English page', () => {
    expect(basisNote({ basis: 'b', basisHi: 'ह' }, 'en')).toEqual({ text: 'b', lang: 'en' });
    expect(basisNote({ basis: 'b', basisHi: 'ह' }, 'hi')).toEqual({ text: 'ह', lang: 'hi' });
    expect(basisNote({ basis: 'b' }, 'hi')).toEqual({ text: 'b', lang: 'en' });
  });
});
