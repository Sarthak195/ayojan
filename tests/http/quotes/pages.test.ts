import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CheckPage from '@/app/[lang]/p/[token]/check/page';
import QuotesPage from '@/app/[lang]/p/[token]/quotes/page';
import { POST as read } from '@/app/[lang]/read/[kind]/route';

import { context, digestOf, post, SEAL_KEY, tokenOf } from '../support';
import {
  CATERER_A,
  CATERER_A_READING,
  CATERER_A_TEXT,
  CATERER_B,
  INJECTION_READING,
  INJECTION_TEXT,
  planToken,
  quoteDeps,
  SIX_QUOTES,
} from './support';

// The real pages open links with the process seal key, so the tests seal with the same one.
beforeEach(() => {
  vi.stubEnv('STATE_SEAL_KEY', SEAL_KEY.toString('base64'));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

type Query = Record<string, string | string[] | undefined>;

async function quotesHtml(token: string, query: Query = {}, lang = 'en'): Promise<string> {
  const page = await QuotesPage({
    params: Promise.resolve({ lang, token }),
    searchParams: Promise.resolve(query),
  });
  return renderToStaticMarkup(page);
}

async function checkHtml(reading: unknown, text: string): Promise<string> {
  const { deps } = quoteDeps({ reading });
  const response = await read(
    post('/en/read/quote', { token: planToken(), quote: text }),
    context({ lang: 'en', kind: 'quote' }),
    deps,
  );
  const token = tokenOf(response);
  return renderToStaticMarkup(await CheckPage({ params: Promise.resolve({ lang: 'en', token }) }));
}

const LUMP_150 = { ...CATERER_B, id: 'C' as const, rateInr: 250_000, guestsCovered: 150 };

describe('GET /[lang]/p/[token]/quotes', () => {
  it('compares A and B under the explainer headings at the current guests', async () => {
    const html = await quotesHtml(planToken([CATERER_A, CATERER_B]));
    expect(html.match(/<h1/g)).toHaveLength(1);
    for (const heading of [
      'What is included',
      'How many guests are covered',
      'Additional charges',
      'What still needs clarification',
      'Comparable total at 200 guests',
      'Against your split',
    ]) {
      expect(html).toContain(`<th scope="row"`);
      expect(html).toContain(heading);
    }
    expect(html).toMatch(/role="region"[^>]*tabindex="0"|tabIndex="0"/i);
    expect(html.match(/Unconfirmed until you book/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain(
      'Caterer B becomes cheaper from 231 guests, before Caterer A&#x27;s GST.',
    );
    expect(html).toContain('Rs 2,60,000');
    expect(html).toContain('Rs 3,00,000');
    expect(html).toContain('plus GST, rate not stated');
    expect(html).toContain('From Caterer A&#x27;s message, unconfirmed');
    expect(html).toContain('Questions to ask Caterer A');
    // Nothing on the page claims a vendor is available or a price confirmed (FR-18).
    expect(html.toLowerCase()).not.toMatch(
      /\bavailable\b(?! right now)|\bconfirmed price|\bis confirmed/,
    );
  });

  it('says a lump sum that no longer covers the guests needs a new quote, never a scaled sum', async () => {
    const html = await quotesHtml(planToken([CATERER_A, LUMP_150]));
    expect(html).toContain('Guest cap exceeded: re-quote needed');
    expect(html).not.toContain('Rs 3,33,333');
  });

  it('offers the paste box, the sample links and the closed form twin', async () => {
    const token = planToken();
    const html = await quotesHtml(token);
    expect(html).toContain('action="/en/read/quote"');
    expect(html).toMatch(/<textarea[^>]*name="quote"[^>]*><\/textarea>/);
    expect(html).toContain('Reading can take up to 40 seconds.');
    expect(html).toContain(`href="/en/p/${token}/quotes?sample=a#quote-paste"`);
    expect(html).toContain('action="/en/enter/quote"');
    expect(html).toMatch(/<details id="quote-form" class/);
    expect(html).toContain('No quotes yet.');
  });

  it('fills the box with the committed sample when opened from a sample link', async () => {
    const html = await quotesHtml(planToken(), { sample: 'a' });
    expect(html).toContain('This is a sample vendor message.');
    expect(html).toMatch(
      /<textarea[^>]*name="quote"[^>]*>Namaste ji, shaadi ke liye veg menu: 1300\/plate/,
    );
    const unknown = await quotesHtml(planToken(), { sample: '<script>' });
    expect(unknown).not.toContain('This is a sample vendor message.');
  });

  it('opens the form under the banner only for the closed unavailable values', async () => {
    const html = await quotesHtml(planToken(), { ai: 'unavailable', why: 'quota' });
    expect(html).toMatch(/<details id="quote-form"[^>]*open=""/);
    expect(html).toContain('The AI reader is unavailable right now');
    const other = await quotesHtml(planToken(), { ai: 'yes', why: 'quota' });
    expect(other).not.toContain('The AI reader is unavailable right now');
  });

  it('hides the paste box once six quotes are held', async () => {
    const html = await quotesHtml(planToken(SIX_QUOTES));
    expect(html).toContain('This plan holds six quotes');
    expect(html).not.toContain('action="/en/read/quote"');
  });

  it('renders in Hindi with the same figures', async () => {
    const html = await quotesHtml(planToken([CATERER_A, CATERER_B]), {}, 'hi');
    expect(html).toContain('200 मेहमानों पर तुलना योग्य कुल');
    expect(html).toContain('बुक करने तक पक्का नहीं');
    expect(html).toContain('Rs 2,60,000');
  });

  it('is a 404 for a damaged link', async () => {
    expect(await digestOf(() => quotesHtml('abc'))).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});

describe('GET /[lang]/p/[token]/check for a quote', () => {
  it('shows each value beside the vendor words and offers "Add as Caterer A"', async () => {
    const html = await checkHtml(CATERER_A_READING, CATERER_A_TEXT);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('Read by AI');
    expect(html).toContain('<q>1300/plate</q>');
    expect(html).toContain('<q>GST extra</q>');
    expect(html).toMatch(/name="rateInr"[^>]*value="1300"/);
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="extraRateUnstated"/);
    expect(html).toContain('Add as Caterer A');
    expect(html).toContain('action="/en/confirm"');
  });

  it('asks for the category when the message did not say what the quote is for', async () => {
    const html = await checkHtml(INJECTION_READING, INJECTION_TEXT);
    expect(html).toContain('Please pick what this quote is for.');
    expect(html).toContain('Add as quote A');
    expect(html).not.toMatch(/confirmed and cheapest/);
  });
});
