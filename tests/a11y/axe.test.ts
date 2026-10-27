// Runs axe-core over the HTML of every view, in both languages, by rendering the real pages
// and routes in process (the way tests/http drives them) inside the same shell the root
// layout builds: skip link, header, main landmark and footer.

import axe from 'axe-core';
import { JSDOM } from 'jsdom';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as confirm } from '@/app/[lang]/confirm/route';
import FormPage from '@/app/[lang]/form/page';
import StartPage from '@/app/[lang]/page';
import CheckPage from '@/app/[lang]/p/[token]/check/page';
import MessagesPage from '@/app/[lang]/p/[token]/messages/page';
import PlanPage from '@/app/[lang]/p/[token]/page';
import QuotesPage from '@/app/[lang]/p/[token]/quotes/page';
import RevisionPage from '@/app/[lang]/p/[token]/revision/page';
import { POST as read } from '@/app/[lang]/read/[kind]/route';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { SkipLink } from '@/components/layout/skip-link';
import { ProblemView } from '@/components/problem/problem-view';
import { dictionaryFor } from '@/i18n/dictionary';
import { LANGS, type Lang } from '@/i18n/lang';
import { PROBLEM_STATUS, type ProblemKind } from '@/i18n/problem-text';
import { exampleBook } from '@/server/pipeline/example-readings';

import { OVER_BUDGET_TOKEN } from '../http/actions/actions-support';
import {
  changeDeps,
  EXPLAINER_REPLY,
  EXPLAINER_TEXT,
  specToken,
  tokenAt,
} from '../http/change/change-support';
import {
  CATERER_A,
  CATERER_A_READING,
  CATERER_A_TEXT,
  CATERER_B,
  planToken,
  quoteDeps,
} from '../http/quotes/support';
import {
  context,
  deps,
  HINGLISH_READING,
  HINGLISH_TEXT,
  post,
  readDeps,
  SEAL_KEY,
  tokenOf,
} from '../http/support';

beforeEach(() => {
  vi.stubEnv('STATE_SEAL_KEY', SEAL_KEY.toString('base64'));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** The page inside the root layout's shell, so landmark and skip-link rules see a whole page. */
function shell(lang: Lang, pathname: string, body: ReactElement): string {
  const { common } = dictionaryFor(lang);
  const html = createElement(
    'html',
    { lang },
    createElement('head', null, createElement('title', null, 'Ayojan')),
    createElement(
      'body',
      null,
      createElement(SkipLink, { label: common.skipLink }),
      createElement(SiteHeader, { lang, pathname, common }),
      createElement('main', { id: 'main', tabIndex: -1 }, body),
      createElement(SiteFooter, { privacy: common.privacyFooter }),
    ),
  );
  return `<!doctype html>${renderToStaticMarkup(html)}`;
}

interface AxeWindow {
  eval: (code: string) => unknown;
  axe: { run: (root: Element, options: axe.RunOptions) => Promise<axe.AxeResults> };
  document: Document;
  close: () => void;
}

async function violationsIn(html: string): Promise<string[]> {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const window = dom.window as unknown as AxeWindow;
  try {
    window.eval(axe.source);
    const results = await window.axe.run(window.document.documentElement, {
      // jsdom computes no layout and loads no stylesheet, so contrast cannot be measured
      // here; it is audited in a real browser in both colour schemes instead.
      rules: { 'color-contrast': { enabled: false } },
    });
    return results.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact ?? '?'}): ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(' | ')}`,
    );
  } finally {
    window.close();
  }
}

interface View {
  readonly name: string;
  readonly path: (lang: Lang) => string;
  readonly render: (lang: Lang) => Promise<ReactElement> | ReactElement;
}

const params = (lang: Lang) => Promise.resolve({ lang });
const planParams = (lang: Lang, token: string) => Promise.resolve({ lang, token });
const queried = (lang: Lang, token: string, query: Record<string, string> = {}) => ({
  params: planParams(lang, token),
  searchParams: Promise.resolve(query),
});

/** A first brief read by the fake model, waiting on the check page. */
async function briefCheckToken(): Promise<string> {
  const { deps: readerDeps } = readDeps({ reading: HINGLISH_READING }, exampleBook());
  const response = await read(
    post('/en/read/brief', { brief: HINGLISH_TEXT }),
    context({ lang: 'en', kind: 'brief' }),
    readerDeps,
  );
  return tokenOf(response);
}

async function quoteCheckToken(): Promise<string> {
  const { deps: readerDeps } = quoteDeps({ reading: CATERER_A_READING });
  const response = await read(
    post('/en/read/quote', { token: planToken(), quote: CATERER_A_TEXT }),
    context({ lang: 'en', kind: 'quote' }),
    readerDeps,
  );
  return tokenAt(response, '/check');
}

async function changeCheckToken(): Promise<string> {
  const { deps: readerDeps } = changeDeps({ reading: EXPLAINER_REPLY });
  const response = await read(
    post('/en/read/change', { token: specToken(), change: EXPLAINER_TEXT }),
    context({ lang: 'en', kind: 'change' }),
    readerDeps,
  );
  return tokenAt(response, '/check');
}

/** The explainer's change applied, so the revision page shows old against new. */
async function changedToken(): Promise<string> {
  const response = await confirm(
    post('/en/confirm', {
      token: await changeCheckToken(),
      intent: 'confirm',
      budgetChoice: 'exact',
      budgetExact: '7,50,000',
    }),
    context({ lang: 'en' }),
    deps(),
  );
  return tokenAt(response, '/revision');
}

const PROBLEMS = Object.keys(PROBLEM_STATUS) as ProblemKind[];

async function views(): Promise<View[]> {
  const [briefCheck, quoteCheck, changeCheck, changed] = await Promise.all([
    briefCheckToken(),
    quoteCheckToken(),
    changeCheckToken(),
    changedToken(),
  ]);
  const quoted = planToken([CATERER_A, CATERER_B]);
  const at = (suffix: string) => (lang: Lang) => `/${lang}${suffix}`;
  const planView = (name: string, token: string, suffix: string, page: typeof PlanPage): View => ({
    name,
    path: at(`/p/${token}${suffix}`),
    render: (lang) => page({ params: planParams(lang, token) }),
  });
  return [
    { name: 'start', path: at(''), render: (lang) => StartPage({ params: params(lang) }) },
    {
      name: 'form twin',
      path: at('/form'),
      render: (lang) => FormPage({ params: params(lang), searchParams: Promise.resolve({}) }),
    },
    {
      name: 'form twin after a failed read',
      path: at('/form'),
      render: (lang) =>
        FormPage({ params: params(lang), searchParams: Promise.resolve({ unavailable: 'busy' }) }),
    },
    planView('check, brief', briefCheck, '/check', CheckPage),
    planView('check, quote', quoteCheck, '/check', CheckPage),
    planView('check, change', changeCheck, '/check', CheckPage),
    planView('plan', quoted, '', PlanPage),
    planView('plan, not priced', planToken(), '', PlanPage),
    planView('plan, over budget', OVER_BUDGET_TOKEN, '', PlanPage),
    {
      name: 'quotes',
      path: at(`/p/${quoted}/quotes`),
      render: (lang) => QuotesPage(queried(lang, quoted)),
    },
    {
      name: 'revision with levers',
      path: at(`/p/${OVER_BUDGET_TOKEN}/revision`),
      render: (lang) => RevisionPage(queried(lang, OVER_BUDGET_TOKEN)),
    },
    {
      name: 'revision after a change',
      path: at(`/p/${changed}/revision`),
      render: (lang) => RevisionPage(queried(lang, changed)),
    },
    {
      name: 'messages',
      path: at(`/p/${quoted}/messages`),
      render: (lang) => MessagesPage(queried(lang, quoted)),
    },
    ...PROBLEMS.map((problem): View => ({
      name: `problem, ${problem}`,
      path: at(''),
      render: (lang) => createElement(ProblemView, { lang, problem }),
    })),
  ];
}

describe('axe-core over every view', () => {
  it('does report a page that breaks a rule, so a clean run means something', async () => {
    const bad =
      '<!doctype html><html lang="en"><head><title>x</title></head><body><img src="a.png"></body></html>';
    expect((await violationsIn(bad)).join(' ')).toContain('image-alt');
  });

  it.each(LANGS)(
    'finds no violation in any view (%s)',
    async (lang) => {
      const found: string[] = [];
      for (const view of await views()) {
        const html = shell(lang, view.path(lang), await view.render(lang));
        // An empty render would pass every rule, so each view must at least have its heading.
        if (!html.includes('<h1')) found.push(`${view.name}: renders no h1`);
        for (const violation of await violationsIn(html)) found.push(`${view.name}: ${violation}`);
      }
      expect(found).toEqual([]);
    },
    120_000,
  );
});
