import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CheckPage from '@/app/[lang]/p/[token]/check/page';
import PlanPage from '@/app/[lang]/p/[token]/page';
import { POST as read } from '@/app/[lang]/read/[kind]/route';
import { ProblemView } from '@/components/problem/problem-view';
import { dictionaryFor } from '@/i18n/dictionary';
import { exampleBook } from '@/server/pipeline/example-readings';

import { BRIEF_STATE } from '../unit/server/http/step-support';
import {
  context,
  digestOf,
  HINGLISH_READING,
  HINGLISH_TEXT,
  post,
  readDeps,
  seal,
  SEAL_KEY,
  tokenOf,
} from './support';

// The real pages open links with the process seal key, so the tests seal with the same one.
beforeEach(() => {
  vi.stubEnv('STATE_SEAL_KEY', SEAL_KEY.toString('base64'));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function checkHtml(token: string, lang = 'en'): Promise<string> {
  return renderToStaticMarkup(await CheckPage({ params: Promise.resolve({ lang, token }) }));
}

async function readSample(reply: Parameters<typeof readDeps>[0] = { reading: HINGLISH_READING }) {
  const { gateway, deps } = readDeps(reply, exampleBook());
  const response = await read(
    post('/en/read/brief', { brief: HINGLISH_TEXT }),
    context({ lang: 'en', kind: 'brief' }),
    deps,
  );
  return { gateway, token: tokenOf(response) };
}

describe('GET /[lang]/p/[token]/check', () => {
  it('makes no model call however often it is reloaded', async () => {
    const { gateway, token } = await readSample();
    expect(gateway.calls).toHaveLength(1);
    const first = await checkHtml(token);
    for (let reload = 0; reload < 10; reload += 1) expect(await checkHtml(token)).toBe(first);
    expect(gateway.calls).toHaveLength(1);
  });

  it('makes the heading the target of the redirect fragment, so focus starts on it', async () => {
    const { token } = await readSample();
    const html = await checkHtml(token);
    expect(/<h1[^>]*>/.exec(html)?.[0]).toMatch(/id="check-summary"[^>]*tabindex="-1"/);
  });

  it('shows each value beside its highlighted quote, the count and the source', async () => {
    const { token } = await readSample();
    const html = await checkHtml(token);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('Read by AI');
    expect(html).toMatch(/\d+ of \d+ values matched your words\./);
    expect(html).toContain('<mark');
    expect(html).toContain('<q>budget 8 lakh</q>');
    expect(html).toContain('Rs 8,00,000');
    expect(html).toContain('role="status"');
  });

  it('asks the unclear date with its reason and no default', async () => {
    const { token } = await readSample();
    const html = await checkHtml(token);
    expect(html).toContain('which is not one date');
    const dateInput = /<input[^>]*name="eventDate"[^>]*>/.exec(html)?.[0] ?? '';
    expect(dateInput).not.toContain('value=');
    expect(dateInput).toContain('aria-invalid="true"');
    // The budget the reader verified is prefilled for the person to correct.
    expect(html).toMatch(/<input[^>]*name="budget"[^>]*value="800000"/);
  });

  it('lists what the app notes but does not plan', async () => {
    const { token } = await readSample();
    const html = await checkHtml(token);
    expect(html).toContain('Noted, not planned by this app');
    expect(html).toContain('DJ chahiye');
  });

  it('labels a recorded example reading as an example (D18)', async () => {
    // Over quota, the exact sample text is served from its committed recording.
    const { gateway, token } = await readSample('quota');
    expect(gateway.calls).toHaveLength(1);
    const html = await checkHtml(token);
    expect(html).toContain('Example reading, recorded on 2026-10-26');
  });

  it('renders in Hindi on the Hindi path', async () => {
    const { token } = await readSample();
    const html = await checkHtml(token, 'hi');
    expect(html).toContain(dictionaryFor('hi').check.title);
  });

  it('sends a link with nothing pending to its plan', async () => {
    const token = seal(BRIEF_STATE);
    const digest = await digestOf(() => checkHtml(token));
    expect(digest).toMatch(/^NEXT_REDIRECT;/);
    expect(digest).toContain(`/en/p/${token};`);
  });
});

describe('a damaged link', () => {
  it('is the 404 page on the check and plan pages', async () => {
    const { token } = await readSample();
    const damaged = `${token.slice(0, 20)}${token[20] === 'A' ? 'B' : 'A'}${token.slice(21)}`;
    const params = Promise.resolve({ lang: 'en', token: damaged });
    expect(await digestOf(() => CheckPage({ params }))).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(await digestOf(() => PlanPage({ params }))).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it("says so on the segment's not-found page", () => {
    const html = renderToStaticMarkup(
      createElement(ProblemView, { lang: 'en', problem: 'damaged-link' }),
    );
    expect(html).toContain(dictionaryFor('en').problems.damagedLink.title);
    expect(html).toContain('href="/en"');
  });
});
