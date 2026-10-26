import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AiUnavailableBanner, PlanBanners } from '@/components/banner/banners';
import { ChoiceGroup } from '@/components/form/choice-group';
import { TextArea, TextField } from '@/components/form/fields';
import { PostForm, ReadingHint, SubmitButton } from '@/components/form/post-form';
import { StatusSummary } from '@/components/layout/status-summary';
import { Amount } from '@/components/money/amount';
import { provenanceLabel } from '@/components/money/provenance-badge';
import { ProblemView } from '@/components/problem/problem-view';
import { StatusWord } from '@/components/status/status-word';
import { MoneyTable } from '@/components/table/money-table';
import type { TaskStatus } from '@/core/timeline/status';

const html = (element: ReactElement): string => renderToStaticMarkup(element);

describe('Amount and provenance', () => {
  it('renders the Indian figure, the lakh words and the label', () => {
    const out = html(
      createElement(Amount, { money: { inr: 750000, provenance: 'your-split' }, lang: 'en' }),
    );
    expect(out).toContain('Rs 7,50,000');
    expect(out).toContain('(7.5 lakh)');
    expect(out).toContain('Your split (planning assumption)');
  });

  it('keeps Rs and Western digits in Hindi, with Hindi words and label', () => {
    const out = html(
      createElement(Amount, {
        money: { inr: 180000, provenance: 'from-quote' },
        lang: 'hi',
        vendor: 'Caterer A',
      }),
    );
    expect(out).toContain('Rs 1,80,000');
    expect(out).toContain('1.8 लाख');
    expect(out).toContain('Caterer A के संदेश से, पक्का नहीं');
  });

  it('labels every provenance, with the vendor and the percent when given', () => {
    expect(provenanceLabel('your-number', 'en')).toBe('Your number');
    expect(provenanceLabel('computed', 'en')).toBe('Computed');
    expect(provenanceLabel('from-quote', 'en')).toBe('From a quote, unconfirmed');
    expect(provenanceLabel('from-quote', 'en', { vendor: 'Caterer B' })).toBe(
      "From Caterer B's message, unconfirmed",
    );
    expect(provenanceLabel('assumption', 'en', { percent: 30 })).toBe(
      'Planning assumption: about 30 percent',
    );
  });

  it('escapes a vendor label rather than rendering markup', () => {
    const out = html(
      createElement(Amount, {
        money: { inr: 5000, provenance: 'from-quote' },
        lang: 'en',
        vendor: '<b>x</b>',
      }),
    );
    expect(out).not.toContain('<b>');
  });
});

describe('MoneyTable', () => {
  const out = html(
    createElement(MoneyTable, {
      id: 'split',
      lang: 'en',
      caption: 'Your split',
      captionNote: 'Not prices.',
      columns: ['Category', 'Allocation', 'Status'],
      rows: [
        {
          key: 'catering',
          header: 'Catering',
          cells: [{ money: { inr: 300000, provenance: 'your-split' } }, { text: 'Not booked' }],
        },
      ],
    }),
  );

  it('is a focusable region labelled by its caption (D35)', () => {
    expect(out).toMatch(
      /<div id="split" role="region" tabindex="0" aria-labelledby="split-caption"/,
    );
    expect(out).toContain('<caption id="split-caption"');
  });

  it('keeps table semantics with scoped headers and a label in every amount cell', () => {
    expect(out).toContain('<th scope="col"');
    expect(out).toContain('<th scope="row"');
    expect(out).toContain('Rs 3,00,000');
    expect(out).toContain('Your split (planning assumption)');
  });
});

describe('StatusWord', () => {
  const statuses: readonly [TaskStatus, string][] = [
    ['done', 'Done'],
    ['late', 'Late'],
    ['atRisk', 'At risk'],
    ['dueThisWeek', 'Due this week'],
    ['onTrack', 'On track'],
  ];

  it.each(statuses)('pairs %s with its word and a hidden icon', (status, word) => {
    const out = html(createElement(StatusWord, { status, lang: 'en' }));
    expect(out).toContain(word);
    expect(out).toContain('<svg');
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain('focusable="false"');
  });

  it('draws a different shape for each status', () => {
    const shapes = statuses.map(([status]) =>
      html(createElement(StatusWord, { status, lang: 'en' })).replace(/class="[^"]*"/g, ''),
    );
    const icons = shapes.map((out) => /<svg.*<\/svg>/.exec(out)?.[0]);
    expect(new Set(icons).size).toBe(statuses.length);
  });
});

describe('banners', () => {
  it.each([
    ['quota', 'the daily quota is used up'],
    ['timeout', 'it did not answer in time'],
    ['nokey', 'no AI key is set up on this server'],
  ] as const)('names the reason %s', (reason, words) => {
    const out = html(createElement(AiUnavailableBanner, { lang: 'en', reason }));
    expect(out).toContain(words);
    expect(out).toContain('Warning');
  });

  it('renders the plan view banners with a labelled gap', () => {
    const out = html(
      createElement(PlanBanners, {
        lang: 'en',
        banners: [
          { kind: 'small-celebration-profile' },
          { kind: 'short-notice', daysToEvent: 9 },
          { kind: 'over-budget', gapInr: 157000 },
        ],
      }),
    );
    expect(out).toContain('Using the small-celebration profile: planning assumptions, check them.');
    expect(out).toContain('9 days away');
    expect(out).toContain('Over budget by');
    expect(out).toContain('Rs 1,57,000');
    expect(out).toContain('Computed');
  });

  it('renders nothing for a plan without banners', () => {
    expect(html(createElement(PlanBanners, { lang: 'en', banners: [] }))).toBe('');
  });
});

describe('status summary and forms', () => {
  it('announces the summary as a status', () => {
    const out = html(createElement(StatusSummary, null, 'Change applied: plan v6'));
    expect(out).toBe(
      '<p role="status" class="my-4 rounded bg-surface px-3 py-2 font-medium">Change applied: plan v6</p>',
    );
  });

  it('posts to a fixed route with the token in a hidden field', () => {
    const out = html(
      createElement(
        PostForm,
        { lang: 'hi', route: 'task', token: 'abc_DEF-1' },
        createElement(SubmitButton, null, 'Done'),
      ),
    );
    expect(out).toContain('<form action="/hi/task" method="post">');
    expect(out).toContain('<input type="hidden" name="token" value="abc_DEF-1"/>');
    expect(out).toContain('<button type="submit"');
  });

  it('ties hint and error to the input and caps free text at 2,000', () => {
    const field = html(
      createElement(TextField, {
        name: 'budget',
        label: 'Total budget (Rs)',
        inputMode: 'numeric',
        hint: 'Whole rupees',
        error: 'We read 8 lakh',
      }),
    );
    expect(field).toContain('<label for="budget"');
    expect(field).toContain('aria-describedby="budget-hint budget-error"');
    expect(field).toContain('inputMode="numeric"');
    const area = html(createElement(TextArea, { name: 'brief', label: 'Your brief' }));
    expect(area).toContain('maxLength="2000"');
  });

  it('groups choices in a fieldset with a legend', () => {
    const out = html(
      createElement(ChoiceGroup, {
        id: 'functions',
        name: 'functions',
        legend: 'Functions',
        type: 'checkbox',
        choices: [{ value: 'haldi', label: 'Haldi', checked: true }],
      }),
    );
    expect(out).toContain('<fieldset id="functions"');
    expect(out).toContain('<legend');
    expect(out).toContain('<label for="functions-haldi"');
    expect(out).toContain('checked=""');
  });

  it('shows the reading hint (D16)', () => {
    expect(html(createElement(ReadingHint, { lang: 'en', id: 'read-hint' }))).toContain(
      'Reading can take up to 40 seconds.',
    );
  });
});

describe('ProblemView', () => {
  it('has one h1 and offers a new plan by default', () => {
    const out = html(createElement(ProblemView, { lang: 'en', problem: 'damaged-link' }));
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('This link cannot be opened');
    expect(out).toContain('href="/en"');
  });

  it('states the D39 text for a full link and the wait for too many requests', () => {
    expect(html(createElement(ProblemView, { lang: 'en', problem: 'link-full' }))).toContain(
      'This plan&#x27;s link is full; undo a step or start a new plan.',
    );
    expect(
      html(
        createElement(ProblemView, {
          lang: 'en',
          problem: 'too-many-requests',
          retryAfterSeconds: 90,
        }),
      ),
    ).toContain('Please wait 2 minutes');
  });
});
