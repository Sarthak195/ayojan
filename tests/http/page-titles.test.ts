import type { Metadata } from 'next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as startPage from '@/app/[lang]/page';
import * as formPage from '@/app/[lang]/form/page';
import { POST as enter } from '@/app/[lang]/enter/[kind]/route';
import * as checkPage from '@/app/[lang]/p/[token]/check/page';
import * as messagesPage from '@/app/[lang]/p/[token]/messages/page';
import * as damagedLink from '@/app/[lang]/p/[token]/not-found';
import * as planPage from '@/app/[lang]/p/[token]/page';
import * as quotesPage from '@/app/[lang]/p/[token]/quotes/page';
import * as revisionPage from '@/app/[lang]/p/[token]/revision/page';
import * as rootLayout from '@/app/layout';
import * as notFound from '@/app/not-found';
import type { Lang } from '@/i18n/lang';
import { LANG_HEADER } from '@/i18n/path';

import { context, HINGLISH_FORM, post, SEAL_KEY, tokenOf } from './support';

// not-found.tsx files take no params: the proxy's header carries the language.
let requestLanguage: Lang = 'en';
vi.mock('next/headers', () => ({
  headers: (): Promise<Headers> => Promise.resolve(new Headers({ [LANG_HEADER]: requestLanguage })),
}));

beforeEach(() => {
  vi.stubEnv('STATE_SEAL_KEY', SEAL_KEY.toString('base64'));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

interface Titled {
  generateMetadata: (props: never) => Promise<Metadata> | Metadata;
}

interface Titles {
  readonly start: string;
  readonly form: string;
  readonly check: string;
  readonly plan: string;
  readonly quotes: string;
  readonly revision: string;
  readonly messages: string;
  readonly notFound: string;
  readonly damagedLink: string;
}

async function titleOf(page: Titled, props: unknown): Promise<string> {
  const metadata = await page.generateMetadata(props as never);
  if (typeof metadata.title !== 'string') throw new Error('page has no plain string title');
  // The root template is what the browser shows.
  return `${metadata.title}: Ayojan`;
}

function listOf(titles: Titles): string[] {
  return Object.keys(titles).map((name) => titles[name as keyof Titles]);
}

async function planToken(lang: Lang): Promise<string> {
  const response = await enter(
    post(`/${lang}/enter/brief`, HINGLISH_FORM),
    context({ lang, kind: 'brief' }),
  );
  return tokenOf(response);
}

async function allTitles(lang: Lang): Promise<Titles> {
  requestLanguage = lang;
  const token = await planToken(lang);
  const langOnly = { params: Promise.resolve({ lang }) };
  const withToken = { params: Promise.resolve({ lang, token }) };
  return {
    start: await titleOf(startPage, langOnly),
    form: await titleOf(formPage, langOnly),
    check: await titleOf(checkPage, langOnly),
    plan: await titleOf(planPage, withToken),
    quotes: await titleOf(quotesPage, langOnly),
    revision: await titleOf(revisionPage, langOnly),
    messages: await titleOf(messagesPage, langOnly),
    notFound: await titleOf(notFound, undefined),
    damagedLink: await titleOf(damagedLink, undefined),
  };
}

describe('page titles (WCAG 2.4.2)', () => {
  it('gives the root a default and a template that keeps the product name last', () => {
    expect(rootLayout.metadata.title).toEqual({ default: 'Ayojan', template: '%s: Ayojan' });
  });

  it.each(['en', 'hi'] as const)('gives every page its own title in %s', async (lang) => {
    const titles = await allTitles(lang);
    const values = listOf(titles);
    expect(new Set(values).size).toBe(values.length);
    for (const title of values) expect(title.endsWith(': Ayojan')).toBe(true);
  });

  it('writes the plan title from its heading, never from the token', async () => {
    const titles = await allTitles('en');
    expect(titles.plan).toBe('Plan v1: Wedding, 26 Feb 2027: Ayojan');
    const token = await planToken('en');
    expect(listOf(titles).some((title) => title.includes(token))).toBe(false);
  });

  it('writes the hi titles in Hindi', async () => {
    const titles = await allTitles('hi');
    expect(titles.start).toBe('योजना शुरू करें: Ayojan');
    expect(titles.notFound).toBe('पेज नहीं मिला: Ayojan');
    expect(titles.plan).toMatch(/[ऀ-ॿ]/);
  });

  it('leaves an unknown language without a title, for the page to 404', async () => {
    const metadata = await startPage.generateMetadata({ params: Promise.resolve({ lang: 'fr' }) });
    expect(metadata.title).toBeUndefined();
  });
});
