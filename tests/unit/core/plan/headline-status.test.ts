import { readFileSync } from 'node:fs';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RevisionView } from '@/app/[lang]/p/[token]/_revision/revision-view';
import { Headline } from '@/app/[lang]/p/[token]/_plan/headline';
import { dictionaryFor } from '@/i18n/dictionary';

import { DATA } from '../../../http/support';

import {
  AI_READ,
  briefOp,
  CATERER_A,
  change,
  EXPLAINER_CHANGE,
  first,
  QUOTE_A,
  versionOf,
  viewOf,
  VENUE_BOOKED,
} from './plan-fixture';

const status = (ops: Parameters<typeof versionOf>[0]): string => versionOf(ops).headline.status;

describe('headline status before anything is priced', () => {
  it('is not-priced for a brief alone, and still after a change with no quote or booking', () => {
    expect(status([briefOp()])).toBe('not-priced');
    expect(status([briefOp(), change({ budgetInr: 900_000, sources: ['more budget'] })])).toBe(
      'not-priced',
    );
  });

  it('is not-priced while every quote is unclear, since nothing is comparable', () => {
    const unclear = { ...CATERER_A, rateInr: null };
    expect(status([briefOp(), { kind: 'quoteAdded', quote: unclear, readBy: AI_READ }])).toBe(
      'not-priced',
    );
  });

  it('stays over-budget before pricing when a change alone overshoots the budget', () => {
    expect(status([briefOp(), EXPLAINER_CHANGE])).toBe('over-budget');
  });

  it('keeps over-budget before pricing, never hiding an overshoot', () => {
    expect(status([briefOp(), change({ guests: 400, sources: ['400 guests now'] })])).toBe(
      'over-budget',
    );
  });

  it('keeps today results once a quote exists', () => {
    expect(status([briefOp(), QUOTE_A])).toBe('within-budget');
  });

  it('keeps today results once a booking exists, within budget or over', () => {
    const roomy = briefOp({ budgetInr: 2_000_000 });
    expect(status([roomy, VENUE_BOOKED])).toBe('within-budget');
    expect(status(first(2))).toBe('over-budget');
  });

  it('never reports not-priced on a plan with a quote or a booking', () => {
    for (const count of [2, 3, 4, 5, 8]) expect(status(first(count))).not.toBe('not-priced');
  });
});

describe('headline status words and row', () => {
  it('has the en and hi strings', () => {
    const [en, hi] = [dictionaryFor('en').plan, dictionaryFor('hi').plan];
    expect([en.notPriced, en.notPricedReason]).toEqual([
      'Not priced yet',
      'add a quote or a booking to compare',
    ]);
    expect([hi.notPriced, hi.notPricedReason]).toEqual([
      'अभी दाम नहीं लगे',
      'तुलना के लिए कोटेशन या बुकिंग जोड़ें',
    ]);
  });

  it.each([
    ['en', 'Not priced yet', 'add a quote or a booking to compare'],
    ['hi', 'अभी दाम नहीं लगे', 'तुलना के लिए कोटेशन या बुकिंग जोड़ें'],
  ] as const)(
    'renders the %s row with a neutral icon and the reason, not Within budget',
    (lang, word, reason) => {
      const html = renderToStaticMarkup(
        createElement(Headline, { headline: versionOf([briefOp()]).headline, lang }),
      );
      expect(html).toContain(word);
      expect(html).toContain(reason);
      expect(html).not.toContain(dictionaryFor(lang).plan.withinBudget);
      expect(html).not.toContain('M4 10.5l4 4 8-9');
      expect(html).toContain('M10 9v5');
    },
  );

  it.each(['en', 'hi'] as const)(
    'labels the unpriced total as the split and leaves out the left-in-budget row in %s',
    (lang) => {
      const words = dictionaryFor(lang).plan;
      const html = renderToStaticMarkup(
        createElement(Headline, { headline: versionOf([briefOp()]).headline, lang }),
      );
      expect(html).toContain(`${words.splitTotal}:`);
      expect(html).not.toContain(`${words.projected}:`);
      expect(html).not.toContain(`${words.leftOver}:`);
      expect(html).not.toContain(`${words.overBy}:`);
    },
  );

  it.each(['en', 'hi'] as const)('keeps the projected and left rows once priced in %s', (lang) => {
    const words = dictionaryFor(lang).plan;
    const headline = versionOf([briefOp({ budgetInr: 2_000_000 }), VENUE_BOOKED]).headline;
    const html = renderToStaticMarkup(createElement(Headline, { headline, lang }));
    expect(html).toContain(`${words.projected}:`);
    expect(html).toContain(`${words.leftOver}:`);
    expect(html).not.toContain(`${words.splitTotal}:`);
  });

  it('keeps the over-by row for an unpriced overshoot', () => {
    const headline = versionOf([briefOp(), EXPLAINER_CHANGE]).headline;
    const html = renderToStaticMarkup(createElement(Headline, { headline, lang: 'en' }));
    expect(html).toContain('Over budget by:');
    expect(html).toContain('Projected cost:');
  });

  it('keeps Within budget and the check icon once priced', () => {
    const headline = versionOf([briefOp({ budgetInr: 2_000_000 }), VENUE_BOOKED]).headline;
    const html = renderToStaticMarkup(createElement(Headline, { headline, lang: 'en' }));
    expect(html).toContain('Within budget');
    expect(html).toContain('M4 10.5l4 4 8-9');
  });
});

describe('the revision page does not state a budget position for an unpriced plan', () => {
  const view = viewOf([briefOp(), change({ budgetInr: 900_000, sources: ['more budget'] })]);
  const html = (lang: 'en' | 'hi'): string =>
    renderToStaticMarkup(createElement(RevisionView, { lang, token: 't', view, data: DATA }));

  it.each(['en', 'hi'] as const)('says Not priced yet in %s, not money left', (lang) => {
    const words = dictionaryFor(lang).revision;
    expect(html(lang)).toContain(words.statusNotPriced(view.current.version));
    expect(html(lang)).not.toContain(words.statusWithin(view.current.version, 'Rs 0'));
  });
});

describe('Hindi labels are as strong as English ones', () => {
  it('raises font-medium to a weight browsers can synthesise for Devanagari', () => {
    const css = readFileSync('src/app/globals.css', 'utf8');
    expect(css).toMatch(/:lang\(hi\) \.font-medium\s*\{\s*font-weight:\s*600;/);
  });
});
