// The two no-typing scenarios: the explainer's change on the plan page (a committed sample with
// a recording) and a birthday a week away on the start page (dated by code, read live, with the
// form twin as its fallback because a text that changes daily can never match a recording).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BIRTHDAY_LEAD_DAYS, birthdayBriefText } from '@/app/[lang]/_brief/birthday-text';
import StartPage from '@/app/[lang]/page';
import CheckPage from '@/app/[lang]/p/[token]/check/page';
import PlanPage from '@/app/[lang]/p/[token]/page';
import { POST as read } from '@/app/[lang]/read/[kind]/route';
import { addDays, parseIsoDate, partsOf, type IsoDate } from '@/core/calendar/day-number';
import { dictionaryFor } from '@/i18n/dictionary';
import { exampleBook } from '@/server/pipeline/example-readings';

import { fakeLlmGateway, type FakeReply } from '../fakes/llm-gateway';
import { EXPLAINER_TEXT, specToken } from './change/change-support';
import { expectReadButtonHint } from './hint-assert';
import { context, deps, location, post, SEAL_KEY, stateOf, TODAY, tokenOf } from './support';

const BRIEF = context({ lang: 'en', kind: 'brief' });

beforeEach(() => {
  vi.stubEnv('STATE_SEAL_KEY', SEAL_KEY.toString('base64'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function day(text: string): IsoDate {
  const parsed = parseIsoDate(text);
  if (!parsed.ok) throw new Error(text);
  return parsed.value;
}

function unescaped(html: string): string {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

// Production's book over the committed fixtures and recordings.
function readDepsFor(kind: 'brief' | 'change', reply: FakeReply) {
  const gateway = fakeLlmGateway(new Map([[kind, reply]]));
  return { gateway, deps: { ...deps(), gateway, examples: exampleBook() } };
}

const recorded: unknown = JSON.parse(
  readFileSync(join(process.cwd(), 'golden/llm/brief-birthday.brief.json'), 'utf8'),
);
const BIRTHDAY_REPLY =
  typeof recorded === 'object' && recorded !== null && 'reply' in recorded ? recorded.reply : null;

describe('the birthday brief text', () => {
  it('is dated 7 days after today by code, across a month and a year end', () => {
    expect(birthdayBriefText(day('2026-10-28'))).toBe(
      'Papa ka 60th birthday, 2 lakh, 80 log, 4 Nov',
    );
    expect(birthdayBriefText(day('2026-12-28'))).toBe(
      'Papa ka 60th birthday, 2 lakh, 80 log, 4 Jan',
    );
  });
});

describe('the start page birthday button', () => {
  it.each(['en', 'hi'] as const)('posts the dated brief in a hidden field (%s)', async (lang) => {
    // Pinned so a wrong clock source or an IST midnight crossing cannot hide behind the page's own call.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T06:00:00Z'));
    const html = renderToStaticMarkup(await StartPage({ params: Promise.resolve({ lang }) }));
    const words = dictionaryFor(lang).start;
    expect(unescaped(html)).toContain(words.birthdayButton);
    const text = 'Papa ka 60th birthday, 2 lakh, 80 log, 4 Nov';
    expect(html).toContain(`<input type="hidden" name="brief" value="${text}"/>`);
    expectReadButtonHint(html, lang, 'birthday-hint');
  });

  it('is read live and resolves to the date a week away', async () => {
    const text = birthdayBriefText(TODAY) ?? '';
    const due = addDays(TODAY, BIRTHDAY_LEAD_DAYS);
    if (!due.ok) throw new Error('lead date');
    const { month, day: dayOfMonth } = partsOf(due.value);
    const quote = text.slice(text.lastIndexOf(', ') + 2);
    const reading = structuredClone(BIRTHDAY_REPLY) as { date: Record<string, unknown> };
    reading.date = { presence: 'present', day: dayOfMonth, month, year: null, quote };
    const { gateway, deps: readDeps } = readDepsFor('brief', { reading });
    const response = await read(post('/en/read/brief', { brief: text }), BRIEF, readDeps);
    expect(location(response)).toMatch(/\/check#check-summary$/);
    expect(gateway.calls).toHaveLength(1);
    const pending = stateOf(tokenOf(response)).pending;
    if (pending?.kind !== 'brief') throw new Error('expected a brief reading');
    expect(pending.readBy.source).toBe('ai');
    expect(pending.values.eventDate).toBe(due.value);
  });

  it.each(
    (['en', 'hi'] as const).flatMap((lang) =>
      (['quota', 'nokey'] as const).map((why) => [lang, why] as const),
    ),
  )('falls back to the form twin (%s, %s)', async (lang, why) => {
    const text = birthdayBriefText(TODAY) ?? '';
    const { deps: readDeps } = readDepsFor('brief', why);
    const response = await read(
      post(`/${lang}/read/brief`, { brief: text }),
      context({ lang, kind: 'brief' }),
      readDeps,
    );
    expect(location(response)).toBe(`/${lang}/form?ai=unavailable&why=${why}`);
  });
});

describe("the plan page's explainer change button", () => {
  it.each(['en', 'hi'] as const)('posts the exact committed sentence (%s)', async (lang) => {
    const token = specToken();
    const html = renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ lang, token }) }));
    const words = dictionaryFor(lang).change;
    expect(unescaped(html)).toContain(words.exampleButton);
    expect(unescaped(html)).toContain(`name="change" value="${EXPLAINER_TEXT}"`);
    expectReadButtonHint(html, lang, 'change-example-hint');
    // The route tests post the token by hand, so only the markup can show the button carries it.
    const note = html.indexOf('id="change-example-note"');
    const form = html.slice(html.lastIndexOf('<form', note), html.indexOf('</form>', note));
    expect(form).toContain(`name="token" value="${token}"`);
    // The hint names no occasion, so it reads right on a birthday or a puja too.
    expect(words.textHint).not.toMatch(/wedding|शादी/);
  });

  it.each(['en', 'hi'] as const)(
    'is served from its labelled recording when the live reserve is spent (%s)',
    async (lang) => {
      const token = specToken();
      const { gateway, deps: readDeps } = readDepsFor('change', 'quota');
      const response = await read(
        post(`/${lang}/read/change`, { token, change: EXPLAINER_TEXT }),
        context({ lang, kind: 'change' }),
        readDeps,
      );
      expect(gateway.calls).toHaveLength(1);
      expect(location(response)).toMatch(/\/check#check-summary$/);
      const checked = tokenOf(response);
      const pending = stateOf(checked).pending;
      if (pending?.kind !== 'change') throw new Error('expected a change reading');
      expect(pending.readBy.source).toBe('example');
      const params = Promise.resolve({ lang, token: checked });
      const html = unescaped(renderToStaticMarkup(await CheckPage({ params })));
      expect(html).toContain('2026-10-26');
    },
  );

  it.each(['en', 'hi'] as const)(
    'says the reader is unavailable on a keyless server, with the form open (%s)',
    async (lang) => {
      const token = specToken();
      const { deps: readDeps } = readDepsFor('change', 'nokey');
      const response = await read(
        post(`/${lang}/read/change`, { token, change: EXPLAINER_TEXT }),
        context({ lang, kind: 'change' }),
        readDeps,
      );
      expect(location(response)).toBe(`/${lang}/p/${token}?ai=unavailable&why=nokey#change-form`);
    },
  );
});
