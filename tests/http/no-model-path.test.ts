import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FormView, unavailableReason } from '@/app/[lang]/form/form-view';
import { POST as read } from '@/app/[lang]/read/[kind]/route';
import { GET as root } from '@/app/route';

import { context, location, post, readDeps } from './support';

// Typed text, not the sample: a sample would be served from its recording instead.
const TYPED = 'Mummy ka 60th birthday, 50 log, budget 1 lakh, 14 March ko.';

describe('the no-model path (FR-40)', () => {
  it.each([
    ['quota', 'quota'],
    ['timeout', 'timeout'],
    ['nokey', 'nokey'],
    // A reply that breaks the schema is our bug; the person sees it as the reader being busy.
    ['schema-violation', 'timeout'],
  ] as const)('a %s failure 303s to the form twin naming the reason', async (reply, why) => {
    const { gateway, deps } = readDeps(reply);
    const response = await read(
      post('/en/read/brief', { brief: TYPED }),
      context({ lang: 'en', kind: 'brief' }),
      deps,
    );
    expect(response.status).toBe(303);
    expect(location(response)).toBe(`/en/form?ai=unavailable&why=${why}`);
    expect(gateway.calls).toHaveLength(1);
  });

  it('shows the banner with the named reason above the form', () => {
    const reason = unavailableReason({ ai: 'unavailable', why: 'quota' });
    expect(reason).toBe('quota');
    const html = renderToStaticMarkup(createElement(FormView, { lang: 'en', unavailable: reason }));
    expect(html).toContain('The AI reader is unavailable right now (the daily quota is used up)');
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it('ignores a reason outside the closed set', () => {
    expect(unavailableReason({ ai: 'unavailable', why: '<script>' })).toBeNull();
    expect(unavailableReason({ why: 'quota' })).toBeNull();
  });

  it('starts every required value empty, with the occasion picker and every row', () => {
    const html = renderToStaticMarkup(createElement(FormView, { lang: 'en', unavailable: null }));
    for (const occasion of [
      'wedding',
      'birthday',
      'anniversary',
      'puja',
      'communityEvent',
      'other',
    ]) {
      expect(html).toMatch(new RegExp(`name="occasion" value="${occasion}"`));
    }
    expect(html).not.toMatch(/name="occasion"[^>]*checked/);
    expect(html).not.toMatch(/name="budget"[^>]*value=/);
    for (const name of [
      'priorityVenue',
      'functionSangeet',
      'mustHave',
      'need',
      'diet',
      'venueLimit',
    ]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('action="/en/enter/brief"');
  });
});

describe('GET /', () => {
  it('answers 303 to the English start page', () => {
    const response = root();
    expect(response.status).toBe(303);
    expect(location(response)).toBe('/en');
  });
});
