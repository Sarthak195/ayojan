import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { POST as messages } from '@/app/[lang]/messages/route';
import type { MessageDeps } from '@/app/[lang]/messages/message-step';
import { messagesModel } from '@/app/[lang]/p/[token]/messages/_messages/messages-model';
import { MessagesView } from '@/app/[lang]/p/[token]/messages/_messages/messages-view';
import type { AiUnavailableReason } from '@/components/banner/banners';
import type { Lang } from '@/i18n/lang';
import { createReadingCache, type ReadingCache } from '@/server/genai/reading-cache';

import { fakeLlmGateway, type FakeReply } from '../../fakes/llm-gateway';
import { harness } from '../../unit/server/genai/ladder-harness';
import { limiter } from '../../unit/server/http/step-support';
import { context, DATA, deps, location, post } from '../support';
import { OVER_BUDGET_OPS, OVER_BUDGET_TOKEN, viewOf } from './actions-support';

const VIEW = viewOf(OVER_BUDGET_OPS);

function model(lang: Lang, cache: ReadingCache = createReadingCache(), nowMs = 0) {
  return messagesModel(VIEW, DATA, lang, cache, nowMs);
}

function pageHtml(
  lang: Lang,
  cache?: ReadingCache,
  nowMs?: number,
  unavailable: AiUnavailableReason | null = null,
): string {
  return renderToStaticMarkup(
    createElement(MessagesView, {
      lang,
      token: OVER_BUDGET_TOKEN,
      model: model(lang, cache, nowMs),
      unavailable,
    }),
  );
}

function write(gatewayDeps: MessageDeps): Promise<Response> {
  return messages(
    post('/en/messages', { token: OVER_BUDGET_TOKEN }),
    context({ lang: 'en' }),
    gatewayDeps,
  );
}

/** A model reply whose lines are the given text, the shape the real client returns. */
function replying(lines: readonly string[]) {
  return () => ({
    reply: {
      output_text: JSON.stringify({ lines: lines.map((text) => ({ text })) }),
      model: 'gemini-3.5-flash-lite',
    },
  });
}

// The template's own lines hold only the plan's numbers, and a plan with no change asks no
// vendor to re-confirm, so they pass the draft check; one invented figure fails it. A draft
// has at most six lines.
const TEMPLATE_LINES = model('en').template.lines.slice(0, 5);
const INVENTED = ['Namaste! The budget is now Rs 17,00,000.', ...TEMPLATE_LINES.slice(0, 4)];

describe('GET /[lang]/p/[token]/messages (spec 6.7, FR-34)', () => {
  it.each(['en', 'hi'] as const)('shows the labelled template and the AI button (%s)', (lang) => {
    const html = pageHtml(lang);
    const label = model(lang).template.label;
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(label);
    expect(html).toMatch(/<textarea[^>]*id="family-text"[^>]*readOnly/);
    expect(html).toContain(`action="/${lang}/messages"`);
  });

  it('shows one read-only message per vendor, from the vendor questions', () => {
    const { vendors } = model('en');
    expect(vendors.length).toBeGreaterThan(0);
    const html = pageHtml('en');
    expect(html.match(/<textarea/g)).toHaveLength(1 + vendors.length);
  });
});

describe('POST /[lang]/messages ("Write it with AI", FR-35)', () => {
  it('checks the draft, keeps it in the cache and the GET shows it labelled n of n', async () => {
    const live = harness(replying(TEMPLATE_LINES));
    const response = await write({ ...deps(), gateway: live.gateway });
    expect(response.status).toBe(303);
    expect(location(response)).toBe(`/en/p/${OVER_BUDGET_TOKEN}/messages`);
    const found = model('en', live.cache, live.clock.now()).drafted;
    if (found?.kind !== 'draft') throw new Error('expected the cached draft');
    const html = pageHtml('en', live.cache, live.clock.now());
    const n = String(found.numbersChecked);
    expect(html).toContain(`AI draft, numbers checked against your plan: ${n} of ${n}`);
    expect(html).not.toContain('Write it with AI');
  });

  it('never shows a draft with an invented number: the template, with the reason', async () => {
    const live = harness(replying(INVENTED));
    const response = await write({ ...deps(), gateway: live.gateway });
    expect(location(response)).toBe(`/en/p/${OVER_BUDGET_TOKEN}/messages`);
    const html = pageHtml('en', live.cache, live.clock.now());
    expect(html).not.toContain('17,00,000');
    expect(html).toContain('The AI draft had a number that is not in your plan');
    expect(html).toContain('Template, numbers from your plan');
  });

  it.each([
    ['quota', 'quota'],
    ['nokey', 'nokey'],
    ['schema-violation', 'timeout'],
  ] as const)('names a failed call (%s) in the 303 and on the page', async (reply, why) => {
    const gateway = fakeLlmGateway(new Map<string, FakeReply>([['familyUpdate', reply]]));
    const response = await write({ ...deps(), gateway });
    expect(location(response)).toBe(
      `/en/p/${OVER_BUDGET_TOKEN}/messages?ai=unavailable&why=${why}`,
    );
    const html = pageHtml('en', undefined, undefined, why);
    expect(html).toContain('The AI writer is unavailable right now');
    expect(html).toContain('Write it with AI');
  });

  it('is a model-rate step and makes exactly one call; the GET makes none', async () => {
    const gateway = fakeLlmGateway(new Map<string, FakeReply>([['familyUpdate', 'quota']]));
    const counting = limiter();
    await write({ ...deps({ limiter: counting }), gateway });
    expect(counting.calls).toEqual(['model']);
    expect(gateway.calls).toHaveLength(1);
    pageHtml('en');
    expect(gateway.calls).toHaveLength(1);
  });

  it('answers 400 for a damaged token and 429 when rate limited', async () => {
    const gateway = fakeLlmGateway(new Map());
    const damaged = await messages(
      post('/en/messages', { token: 'abc' }),
      context({ lang: 'en' }),
      { ...deps(), gateway },
    );
    expect(damaged.status).toBe(400);
    const limited = await messages(
      post('/en/messages', { token: OVER_BUDGET_TOKEN }),
      context({ lang: 'en' }),
      { ...deps({ limiter: limiter({ allowed: false, retryAfterSeconds: 30 }) }), gateway },
    );
    expect(limited.status).toBe(429);
    expect(gateway.calls).toHaveLength(0);
  });
});
