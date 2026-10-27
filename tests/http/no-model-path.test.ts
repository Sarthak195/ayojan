import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FormView, unavailableReason } from '@/app/[lang]/form/form-view';
import { POST as enter } from '@/app/[lang]/enter/[kind]/route';
import { POST as read } from '@/app/[lang]/read/[kind]/route';
import { GET as root } from '@/app/route';

import { context, deps, location, post, readDeps, tokenOf } from './support';

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

describe('the form twin keeps wedding fields in a closed fold', () => {
  const html = (lang: 'en' | 'hi'): string =>
    renderToStaticMarkup(createElement(FormView, { lang, unavailable: null }));

  it.each([
    ['en', 'Wedding only'],
    ['hi', 'सिर्फ़ शादी के लिए'],
  ] as const)(
    'holds the functions and wedding must-haves in a closed details (%s)',
    (lang, title) => {
      const fold =
        /<details[^>]*id="wedding-only"[^>]*>[\s\S]*?<\/details>/.exec(html(lang))?.[0] ?? '';
      expect(fold).not.toBe('');
      expect(fold.split('>')[0]).not.toMatch(/\sopen/);
      expect(fold).toMatch(new RegExp(`<summary[^>]*>${title}`));
      for (const name of [
        'functionHaldi',
        'functionMehndi',
        'functionSangeet',
        'functionWedding',
      ]) {
        expect(fold).toContain(`name="${name}"`);
      }
      expect(fold).toContain('value="mehndiArtist"');
      expect(fold).toContain('value="choreographer"');
      // Defaults stay Not sure and unticked, so a closed fold posts what an absent answer means.
      expect(fold).toMatch(/name="functionHaldi" checked="" value="unsure"/);
      expect(fold).not.toMatch(/name="mustHave"[^>]*checked/);
      // The general must-haves and the other rows stay outside it.
      const outside = html(lang).replace(fold, '');
      expect(outside).toContain('value="dhol"');
      expect(outside).toContain('value="liveCounter"');
      expect(outside).not.toContain('name="functionHaldi"');
    },
  );

  it('still gives a plan for a birthday posted without opening the fold', async () => {
    const response = await enter(
      post('/en/enter/brief', {
        occasion: 'birthday',
        budget: '1 lakh',
        guests: '50',
        eventDate: '2027-03-14',
        venueCapacity: '',
        functionHaldi: 'unsure',
        functionMehndi: 'unsure',
        functionSangeet: 'unsure',
        functionWedding: 'unsure',
        functionReception: 'unsure',
        priorityVenue: 'standard',
        priorityCatering: 'standard',
        priorityDecor: 'standard',
        priorityPhoto: 'standard',
        priorityMusic: 'standard',
        priorityInvites: 'standard',
        priorityContingency: 'standard',
      }),
      context({ lang: 'en', kind: 'brief' }),
      deps(),
    );
    expect(response.status).toBe(303);
    expect(tokenOf(response)).not.toBe('');
  });
});

describe('GET /', () => {
  it('answers 303 to the English start page', () => {
    const response = root();
    expect(response.status).toBe(303);
    expect(location(response)).toBe('/en');
  });
});
