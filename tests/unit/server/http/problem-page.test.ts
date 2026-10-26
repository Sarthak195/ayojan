import { describe, expect, it } from 'vitest';

import { PROBLEM_STATUS, type ProblemKind } from '@/i18n/problem-text';
import { escapeHtml, problemHtml, problemResponse } from '@/server/http/problem-page';

const KINDS = Object.keys(PROBLEM_STATUS) as ProblemKind[];

describe('problem pages from route handlers', () => {
  it.each(KINDS)('%s is a script-free HTML page in each language with a link back', (kind) => {
    for (const lang of ['en', 'hi'] as const) {
      const page = problemHtml({ lang, problem: kind });
      expect(page.startsWith('<!doctype html>')).toBe(true);
      expect(page).toContain(`<html lang="${lang}">`);
      expect(page).not.toMatch(/<script/i);
      expect(page.match(/<h1>/g)).toHaveLength(1);
      expect(page).toContain(`href="/${lang}"`);
    }
  });

  it('answers with the status of arch 6.3 and never caches', () => {
    expect(problemResponse({ lang: 'en', problem: 'wrong-type' }).status).toBe(415);
    expect(problemResponse({ lang: 'en', problem: 'too-large' }).status).toBe(413);
    expect(problemResponse({ lang: 'en', problem: 'malformed' }).status).toBe(400);
    expect(problemResponse({ lang: 'en', problem: 'link-full' }).status).toBe(422);
    const response = problemResponse({ lang: 'en', problem: 'damaged-link' });
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
  });

  it('states the D39 sentence for a full link', async () => {
    const text = await problemResponse({ lang: 'en', problem: 'link-full' }).text();
    expect(text).toContain('This plan&#39;s link is full; undo a step or start a new plan.');
  });

  it('sends Retry-After on a 429 and states the same wait', async () => {
    const response = problemResponse({
      lang: 'en',
      problem: 'too-many-requests',
      retryAfterSeconds: 125,
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('125');
    expect(await response.text()).toContain('Please wait 3 minutes');
  });

  it('links back to the plan when the step had a token', () => {
    const page = problemHtml({
      lang: 'hi',
      problem: 'op-cap',
      back: { to: 'plan', lang: 'hi', token: 'tok_EN-9' },
    });
    expect(page).toContain('href="/hi/p/tok_EN-9"');
    expect(page).toContain('अपनी योजना पर वापस जाएँ');
  });

  it('refuses a back link that is not a known destination', () => {
    expect(() =>
      problemHtml({
        lang: 'en',
        problem: 'op-cap',
        back: { to: 'plan', lang: 'en', token: '//evil.example' },
      }),
    ).toThrow();
  });

  it('escapes every special character', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});
