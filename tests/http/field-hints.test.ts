import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FormPage from '@/app/[lang]/form/page';
import CheckPage from '@/app/[lang]/p/[token]/check/page';
import { categoryLabels } from '@/app/[lang]/p/[token]/_change/category-labels';
import { LeverRow } from '@/app/[lang]/p/[token]/revision/_levers/lever-row';
import QuotesPage from '@/app/[lang]/p/[token]/quotes/page';
import { POST as read } from '@/app/[lang]/read/[kind]/route';
import type { LeverOption } from '@/core/levers/lever-types';
import { exampleBook } from '@/server/pipeline/example-readings';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { Op } from '@/schemas/plan/op';

import { AI_READ, HINGLISH_BRIEF } from '../fixtures/plan-readings';
import { CATERER_A_READING, CATERER_A_TEXT, quoteDeps } from './quotes/support';
import {
  context,
  DATA,
  HINGLISH_READING,
  HINGLISH_TEXT,
  post,
  readDeps,
  seal,
  SEAL_KEY,
  tokenOf,
} from './support';

// Commit 73b81cf gave guests and capacity their own hints and named categories as the plan's
// profile does. These pin the rendered pages, so none of it can slip back unnoticed.

beforeEach(() => {
  vi.stubEnv('STATE_SEAL_KEY', SEAL_KEY.toString('base64'));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const LANGS: readonly Lang[] = ['en', 'hi'];

/** The text of the hint paragraph a named input points at through aria-describedby. */
function hintOf(html: string, name: string): string {
  const input = new RegExp(`<input[^>]*name="${name}"[^>]*>`).exec(html)?.[0] ?? '';
  const ids = (/aria-describedby="([^"]*)"/.exec(input)?.[1] ?? '').split(' ');
  for (const id of ids) {
    const text = new RegExp(`<p id="${id}"[^>]*>([^<]*)</p>`).exec(html)?.[1];
    if (text !== undefined) return text;
  }
  return '';
}

function birthdayToken(): string {
  const op: Op = {
    kind: 'briefConfirmed',
    brief: { ...HINGLISH_BRIEF, occasion: 'birthday' },
    readBy: AI_READ,
  };
  return seal({ schema: 1, ops: [op] });
}

describe.each(LANGS)('the guests and capacity hints (%s)', (lang) => {
  const form = dictionaryFor(lang).form;

  it('are on the form, and guests no longer wears the budget hint', async () => {
    const html = renderToStaticMarkup(
      await FormPage({ params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) }),
    );
    expect(hintOf(html, 'guests')).toBe(form.guestsHint);
    expect(hintOf(html, 'venueCapacity')).toBe(form.capacityHint);
    expect(hintOf(html, 'guests')).not.toBe(form.numberHint);
  });

  it('are on the check page', async () => {
    const { deps } = readDeps({ reading: HINGLISH_READING }, exampleBook());
    const response = await read(
      post(`/${lang}/read/brief`, { brief: HINGLISH_TEXT }),
      context({ lang, kind: 'brief' }),
      deps,
    );
    const html = renderToStaticMarkup(
      await CheckPage({ params: Promise.resolve({ lang, token: tokenOf(response) }) }),
    );
    expect(hintOf(html, 'guests')).toBe(form.guestsHint);
    expect(hintOf(html, 'venueCapacity')).toBe(form.capacityHint);
  });
});

/** A category radio's visible label, which closes its label element. */
const radio = (label: string): string => `<span>${label}</span></label>`;

describe.each(LANGS)('the quote form of a birthday plan (%s)', (lang) => {
  const words = dictionaryFor(lang).quotes;
  const drinks = categoryLabels(DATA.budgetWeights, 'celebration', lang)('catering');
  const generic = dictionaryFor(lang).form.categories.catering;

  async function quotesHtml(): Promise<string> {
    const page = await QuotesPage({
      params: Promise.resolve({ lang, token: birthdayToken() }),
      searchParams: Promise.resolve({}),
    });
    return renderToStaticMarkup(page);
  }

  it('words the category radios by the profile and says what advance and rate take', async () => {
    const html = await quotesHtml();
    expect(drinks).not.toBe(generic);
    expect(html).toContain(radio(drinks));
    expect(html).not.toContain(radio(generic));
    expect(hintOf(html, 'advancePercent')).toBe(words.advanceHint);
    expect(hintOf(html, 'rateInr')).toBe(words.rateHint);
  });

  it('does the same on the page that checks a pasted quote', async () => {
    const { deps } = quoteDeps({ reading: CATERER_A_READING });
    const response = await read(
      post(`/${lang}/read/quote`, { token: birthdayToken(), quote: CATERER_A_TEXT }),
      context({ lang, kind: 'quote' }),
      deps,
    );
    const html = renderToStaticMarkup(
      await CheckPage({ params: Promise.resolve({ lang, token: tokenOf(response) }) }),
    );
    expect(html).toContain(radio(drinks));
    expect(html).not.toContain(radio(generic));
  });
});

describe.each(LANGS)('a lever blocked by a booking in a birthday plan (%s)', (lang) => {
  it('names the category as the profile does', () => {
    const row = DATA.levers.levers[0];
    if (row === undefined) throw new Error('fixture needs a lever');
    const option: LeverOption = {
      id: row.id,
      effect: row.effect,
      label: { en: row.en, hi: row.hi },
      consequence: row.consequence,
      basis: row.basis,
      basisHi: null,
      category: 'catering',
      percent: 30,
      status: 'disabled',
      reason: { kind: 'booked', category: 'catering' },
      provenance: 'assumption',
      saving: { inr: 30_000, provenance: 'assumption' },
      bufferLeft: null,
      fasterAlternativeFor: null,
      showAnywayAllowed: false,
    };
    const labelOf = categoryLabels(DATA.budgetWeights, 'celebration', lang);
    const html = renderToStaticMarkup(
      createElement(LeverRow, { option, lang, ticked: false, labelOf }),
    );
    const sentence = dictionaryFor(lang).levers.booked(labelOf('catering'));
    expect(html).toContain(sentence);
    expect(sentence).not.toContain(dictionaryFor(lang).form.categories.catering);
  });
});
