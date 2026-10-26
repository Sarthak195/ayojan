import 'server-only';

import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import { PROBLEM_STATUS, problemText, type ProblemKind } from '@/i18n/problem-text';

import { locationOf, type Destination } from './see-other';

// Route handlers answer problems with this fixed template rather than React: they compile
// under the react-server condition, where react-dom/server is not available. Every
// interpolation is escaped, and the page has no script, so it renders with JavaScript off
// and gives a planted string nowhere to run. Inline styles are allowed by the CSP.

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

const STYLE = [
  ':root{color-scheme:light dark;--bg:#fff;--fg:#171717;--muted:#4b5563;--focus:#1d4ed8}',
  '@media (prefers-color-scheme:dark){:root{--bg:#0a0a0a;--fg:#ededed;--muted:#a3a3a3;--focus:#93c5fd}}',
  'body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,sans-serif;line-height:1.5}',
  'header,main,footer{max-width:48rem;margin:0 auto;padding:1rem}',
  'a{color:inherit;display:inline-flex;min-height:44px;align-items:center}',
  ':focus-visible{outline:3px solid var(--focus);outline-offset:2px}',
  '.skip{position:absolute;left:-999px}.skip:focus{left:.5rem;top:.5rem;background:var(--bg);padding:0 1rem}',
  'footer{color:var(--muted);font-size:.875rem}',
].join('');

export interface ProblemPageOptions {
  readonly lang: Lang;
  readonly problem: ProblemKind;
  /** Defaults to the problem's status in PROBLEM_STATUS. */
  readonly status?: number;
  /** Where the back link goes; the start page when absent. Checked by locationOf. */
  readonly back?: Destination;
  /** For 429: the Retry-After header and the wait stated on the page. */
  readonly retryAfterSeconds?: number;
}

/** The complete HTML document for a problem. */
export function problemHtml(options: ProblemPageOptions): string {
  const { lang, problem, back, retryAfterSeconds } = options;
  const { common, problems } = dictionaryFor(lang);
  const { title, body } = problemText(problems, problem, retryAfterSeconds);
  const destination: Destination = back ?? { to: 'start', lang };
  const backLabel = destination.to === 'start' ? problems.startNewPlan : problems.backToPlan;
  const status = options.status ?? PROBLEM_STATUS[problem];
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(lang)}">`,
    '<head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${escapeHtml(`${title}: ${common.productName}`)}</title>`,
    `<style>${STYLE}</style></head>`,
    `<body><a class="skip" href="#main">${escapeHtml(common.skipLink)}</a>`,
    `<header><a href="/${escapeHtml(lang)}">${escapeHtml(common.productName)}</a></header>`,
    `<main id="main"><p>${escapeHtml(problems.statusLine(status))}</p>`,
    `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>`,
    `<p><a href="${escapeHtml(locationOf(destination))}">${escapeHtml(backLabel)}</a></p></main>`,
    `<footer><p>${escapeHtml(common.privacyFooter)}</p></footer>`,
    '</body></html>',
  ].join('');
}

/** A problem as a Response: no-store, HTML, and Retry-After on a 429. */
export function problemResponse(options: ProblemPageOptions): Response {
  const status = options.status ?? PROBLEM_STATUS[options.problem];
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  if (status === 429) {
    headers.set('Retry-After', String(Math.max(1, Math.ceil(options.retryAfterSeconds ?? 60))));
  }
  return new Response(problemHtml(options), { status, headers });
}
