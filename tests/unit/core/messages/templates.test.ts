import { describe, expect, it } from 'vitest';

import { checkDraft } from '@/core/messages/draft-check';
import { packFor } from '@/core/messages/render-values';
import type { MessageFactsInput } from '@/core/messages/fact-types';
import {
  TEMPLATE_LABEL_EN,
  TEMPLATE_LABEL_KEY,
  familyUpdateTemplate,
  vendorTemplates,
} from '@/core/messages/templates';
import type { Language } from '@/core/rupees/format';

import { REVISED, VENUE, dataQuestions, makeFacts, questionRow } from './facts-fixture';

const LANGUAGES: readonly Language[] = ['en', 'hi'];

const VARIANTS: readonly [string, Partial<MessageFactsInput>][] = [
  ['a revised plan over budget', {}],
  ['a plan with no revision', { before: null }],
  ['a plan under budget', { now: { ...REVISED.now, projectedInr: 1_300_000 } }],
  ['a plan exactly on budget', { now: { ...REVISED.now, projectedInr: 1_500_000 } }],
  [
    'a plan with nothing priced yet',
    { now: { ...REVISED.now, projectedInr: 1_500_000, priced: false } },
  ],
  [
    'a budget that rounds to a different lakh figure',
    { now: { ...REVISED.now, budgetInr: 745_000 } },
  ],
  ['an unchanged revision', { before: REVISED.now }],
  [
    'a plan with nothing to report',
    { levers: [], atRisk: [], unclearQuotes: [], diet: [], venueLimits: [] },
  ],
  ['an event today', { daysToEvent: 0 }],
  ['one day to go', { daysToEvent: 1 }],
];

describe('the family update template', () => {
  it.each(LANGUAGES)(
    'says nothing is priced, not on budget, before any quote in %s',
    (language) => {
      const now = { ...REVISED.now, projectedInr: 1_500_000, priced: false };
      const { text } = familyUpdateTemplate(makeFacts({ now }), language);
      const pack = packFor(language).sentences;
      expect(text).toContain(pack.notPriced);
      expect(text).not.toContain(pack.onBudget);
    },
  );

  it.each(LANGUAGES)('is labelled as a template in %s', (language) => {
    const update = familyUpdateTemplate(makeFacts(), language);
    expect(update.labelKey).toBe(TEMPLATE_LABEL_KEY);
    expect(update.label).not.toBe('');
    expect(update.text).toBe(update.lines.join('\n'));
  });

  it('carries the English label the requirements fix', () => {
    expect(familyUpdateTemplate(makeFacts(), 'en').label).toBe(TEMPLATE_LABEL_EN);
  });

  it.each(
    VARIANTS.flatMap(([name, overrides]) =>
      LANGUAGES.map((language) => [name, overrides, language] as const),
    ),
  )('writes only numbers from the facts for %s in %s', (_name, overrides, language) => {
    const facts = makeFacts(overrides);
    const update = familyUpdateTemplate(facts, language);
    const verdict = checkDraft({
      lines: update.lines,
      facts,
      language,
      requiredQuestionIds: [],
    });
    expect(verdict).toMatchObject({ ok: true });
    expect(update.text).not.toMatch(/[{}]/);
  });

  it('states the old and new numbers and the Indian-grouped amounts in English', () => {
    const text = familyUpdateTemplate(makeFacts(), 'en').text;
    expect(text).toContain('Update on our wedding on 12 Dec 2026.');
    expect(text).toContain('47 days to go.');
    expect(text).toContain(
      'The budget is now Rs 15,00,000 (15 lakh) (it was Rs 14,00,000 (14 lakh)).',
    );
    expect(text).toContain('We now expect 250 guests (it was 280).');
    expect(text).toContain('The date is now 12 Dec 2026 (it was 26 Dec 2026).');
    expect(text).toContain('We are Rs 1,50,000 (1.5 lakh) over budget.');
    expect(text).toContain('Simpler decor (saves Rs 45,000)');
    expect(text).toContain('Print invitations (late, due by 20 Nov 2026)');
    expect(text).toContain('We will send questions to 2 vendors: Caterer A, Venue.');
    expect(text).toContain('Caterer A (tax rate)');
    expect(text).toContain('Kept in mind: vegetarian food only, everything indoors.');
  });

  it('adds a lakh word only when it reads back as the same rupees', () => {
    const text = familyUpdateTemplate(
      makeFacts({ now: { ...REVISED.now, budgetInr: 745_000, projectedInr: 745_000 } }),
      'en',
    ).text;
    expect(text).toContain('Rs 7,45,000');
    expect(text).not.toContain('7.5 lakh');
  });

  it('writes the Hindi update in Devanagari with Western digits for amounts', () => {
    const text = familyUpdateTemplate(makeFacts(), 'hi').text;
    expect(text).toContain('12 दिसंबर 2026');
    expect(text).toContain('Rs 15,00,000 (15 लाख)');
    expect(text).toContain('सादी सजावट');
    expect(text).toContain('निमंत्रण छपवाना');
  });

  it('says where the plan stands, not what changed, when there is no revision', () => {
    const text = familyUpdateTemplate(makeFacts({ before: null }), 'en').text;
    expect(text).toContain('Here is where the plan stands.');
    expect(text).not.toContain('(it was');
  });

  it('says nothing changed when the headline numbers are the same', () => {
    const text = familyUpdateTemplate(makeFacts({ before: REVISED.now }), 'en').text;
    expect(text).toContain('have not changed');
  });

  it('leaves out lines for things that did not happen', () => {
    const text = familyUpdateTemplate(
      makeFacts({
        levers: [],
        atRisk: [],
        unclearQuotes: [],
        diet: [],
        venueLimits: [],
        daysToEvent: 0,
      }),
      'en',
    ).text;
    expect(text).not.toMatch(/Needs attention|we chose|still unclear|Kept in mind|to go/);
  });

  it('describes a raised budget as an addition and a saving as a saving', () => {
    const text = familyUpdateTemplate(
      makeFacts({
        levers: [
          {
            id: 'raise-budget',
            label: { en: 'Raise budget', hi: 'बजट बढ़ाना' },
            effectInr: 100_000,
          },
        ],
      }),
      'en',
    ).text;
    expect(text).toContain('Raise budget (adds Rs 1,00,000 (1 lakh))');
  });
});

describe('vendor message templates', () => {
  const questions = dataQuestions();

  it.each(LANGUAGES)('writes one message per vendor, labelled as a template, in %s', (language) => {
    const messages = vendorTemplates(makeFacts(), questions, language);
    expect(messages.map((message) => message.category)).toEqual(['catering', 'venue']);
    for (const message of messages) {
      expect(message.labelKey).toBe(TEMPLATE_LABEL_KEY);
      expect(message.text).not.toMatch(/[{}]/);
    }
  });

  it('builds each question from the wording in the data and fills its placeholders', () => {
    const [caterer, venue] = vendorTemplates(makeFacts(), questions, 'en');
    const guestRow = questionRow('guest-count-reconfirmation');
    const capacityRow = questionRow('venue-capacity');
    expect(caterer?.text).toContain(`- ${guestRow.en.replace('{guests}', '250')}`);
    expect(venue?.text).toContain(
      `- ${capacityRow.en.replaceAll('{guests}', '250').replaceAll('{capacity}', '220')}`,
    );
    expect(venue?.text).toContain('Our date has changed to 12 Dec 2026.');
    expect(caterer?.questionIds).toEqual(['guest-count-reconfirmation', 'tax-rate']);
  });

  it('writes the Hindi wording from the data', () => {
    const [caterer] = vendorTemplates(makeFacts(), questions, 'hi');
    const taxRow = questionRow('tax-rate');
    expect(caterer?.text).toContain(taxRow.hi);
    expect(caterer?.text).toContain('नमस्ते,');
  });

  it('opens with the occasion, date and guest count from the plan, and carries no price', () => {
    const [caterer] = vendorTemplates(makeFacts(), questions, 'en');
    expect(caterer?.lines[1]).toBe(
      'This is about our wedding on 12 Dec 2026, for about 250 guests.',
    );
    expect(caterer?.text).not.toMatch(/Rs /);
  });

  it('drops a capacity question when no capacity was entered, never sending a placeholder', () => {
    const facts = makeFacts({
      vendors: [{ ...VENUE, bookedCapacity: null }],
    });
    const [venue] = vendorTemplates(facts, questions, 'en');
    expect(venue?.questionIds).toEqual(['date-reconfirmation']);
    expect(venue?.text).not.toMatch(/[{}]/);
  });

  it('writes no message for a vendor whose only question cannot be filled', () => {
    const facts = makeFacts({
      vendors: [{ ...VENUE, questionIds: ['venue-capacity'], bookedCapacity: null }],
    });
    expect(vendorTemplates(facts, questions, 'en')).toEqual([]);
  });

  it('skips a question id that the data does not hold', () => {
    const rows = questions.filter((row) => row.id !== 'tax-rate');
    const [caterer] = vendorTemplates(makeFacts(), rows, 'en');
    expect(caterer?.questionIds).toEqual(['guest-count-reconfirmation']);
  });

  it('writes no vendor message for a plan with no revision and no other question', () => {
    const facts = makeFacts({ before: null, unclearQuotes: [] });
    const messages = vendorTemplates(facts, questions, 'en');
    expect(messages.map((message) => message.questionIds)).toEqual([['tax-rate']]);
  });
});
