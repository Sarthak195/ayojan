import { describe, expect, it } from 'vitest';

import { checkDraft } from '@/core/messages/draft-check';
import type { DraftVerdict } from '@/core/messages/draft-check';
import type { MessageFactsInput } from '@/core/messages/fact-types';
import { reconfirmationQuestionIds } from '@/core/messages/message-facts';
import type { Language } from '@/core/rupees/format';
import type { QuestionId } from '@/schemas/generated/ids';

import { REVISED, makeFacts } from './facts-fixture';

function check(
  lines: readonly string[],
  overrides: Partial<MessageFactsInput> = {},
  options: { language?: Language; required?: readonly QuestionId[] } = {},
): DraftVerdict {
  return checkDraft({
    lines,
    facts: makeFacts(overrides),
    language: options.language ?? 'en',
    requiredQuestionIds: options.required ?? [],
  });
}

function offenders(verdict: DraftVerdict): string[] {
  return verdict.ok ? [] : verdict.offendingNumbers.map((number) => number.text);
}

const LAKH_PLAN: Partial<MessageFactsInput> = {
  now: { ...REVISED.now, budgetInr: 750_000, projectedInr: 750_000 },
  before: { ...REVISED.now, budgetInr: 750_000, projectedInr: 750_000 },
};

describe('a draft whose numbers are all in the facts', () => {
  it.each<[string, string]>([
    ['a plain amount with Indian grouping', 'The budget is now Rs 15,00,000.'],
    ['an amount with the rupee marker glued on', 'Rs.15,00,000/- is the budget.'],
    ['a count of guests', 'We now expect 250 guests.'],
    ['the days left', 'There are 47 days to go.'],
    ['the day and year of the event', 'The wedding is on 12 December 2026.'],
    ['a difference the facts imply', '30 fewer guests and Rs 1,00,000 more budget.'],
    ['a lakh form of an exact amount', 'We are Rs 1.5 lakh over budget.'],
    ['no numbers at all', 'We will keep you posted.'],
  ])('is accepted with %s', (_name, line) => {
    expect(check([line]).ok).toBe(true);
  });

  it('accepts 7.5 lakh for 7,50,000', () => {
    expect(check(['Our budget is 7.5 lakh.'], LAKH_PLAN)).toMatchObject({ ok: true });
    expect(check(['Our budget is Rs 7,50,000.'], LAKH_PLAN)).toMatchObject({ ok: true });
  });

  it.each<[string, string]>([
    ['Devanagari digits with Indian commas', 'बजट ७,५०,००० रुपये है।'],
    ['a Devanagari lakh form', 'बजट ७.५ लाख है।'],
    ['a Hindi number word with a lakh unit', 'बजट साढ़े सात लाख है।'],
  ])('accepts %s for 7,50,000', (_name, line) => {
    expect(check([line], LAKH_PLAN).ok).toBe(true);
  });

  it('reports how many numbers were checked, for the "n of n" badge', () => {
    const verdict = check(['Budget Rs 15,00,000.', '250 guests, 47 days to go.']);
    expect(verdict).toEqual({ ok: true, numbersFound: 3, numbersInFacts: 3 });
  });
});

describe('a draft with a number that is not in the facts', () => {
  it('rejects an invented amount and names it', () => {
    const verdict = check(['The budget is now Rs 17,00,000.']);
    expect(verdict).toMatchObject({
      ok: false,
      reasons: ['number-not-in-facts'],
      offendingNumbers: [{ text: '17,00,000', value: 1_700_000, line: 0, reason: 'not-in-facts' }],
    });
  });

  it('rejects an invented lakh form', () => {
    expect(offenders(check(['We could save 3 lakh more.']))).toEqual(['3 lakh']);
  });

  it('rejects invented Devanagari digits', () => {
    const verdict = check(['बजट ७,६०,००० रुपये है।'], LAKH_PLAN);
    expect(offenders(verdict)).toEqual(['७,६०,०००']);
  });

  it('rejects an invented Hindi number-word amount', () => {
    expect(offenders(check(['बजट सवा लाख है।']))).toEqual(['सवा लाख']);
  });

  it('rejects "2 weeks" when 14 days is the only fact', () => {
    const verdict = check(['The date moved by 2 weeks.'], {
      vendors: [],
      atRisk: [],
      levers: [],
      unclearQuotes: [],
    });
    expect(offenders(verdict)).toEqual(['2']);
    expect(check(['The date moved by 14 days.']).ok).toBe(true);
  });

  it('reports the line of each offending number', () => {
    const verdict = check(['Budget Rs 15,00,000.', 'Spend Rs 99,99,999.']);
    expect(verdict).toMatchObject({ ok: false, offendingNumbers: [{ line: 1 }] });
  });

  it('counts what was found and what the facts support', () => {
    const verdict = check(['250 guests and 999 tasks.']);
    expect(verdict).toMatchObject({ numbersFound: 2, numbersInFacts: 1 });
  });

  it('does not join a number on one line to a unit on the next', () => {
    const verdict = check(['Budget Rs 5', 'lakh more']);
    expect(offenders(verdict)).toEqual(['5']);
  });

  it.each<[string, string]>([
    ['a decimal count', 'It will take 2.5 days.'],
    ['a decimal rupee amount', 'Rs 1,500.50 extra.'],
    ['a number too large to read exactly', 'Rs 99999999999999999999 extra.'],
  ])('rejects %s as unreadable', (_name, line) => {
    const verdict = check([line]);
    expect(verdict).toMatchObject({ ok: false, reasons: ['number-unreadable'] });
  });
});

describe('numbers written in forms the scanner does not read', () => {
  it.each<[string, string, string]>([
    ['an English number word', 'About thirty guests may skip it.', 'thirty'],
    ['a Hindi number word without a unit', 'हमें पाँच काम निपटाने हैं।', 'पाँच'],
    ['full-width digits', 'We invite ２５０ guests.', '２'],
    ['Arabic-Indic digits', 'We invite ٢٥٠ guests.', '٢'],
  ])('rejects %s as unreadable', (_name, line, first) => {
    const verdict = check([line]);
    expect(verdict).toMatchObject({ ok: false, reasons: ['number-unreadable'] });
    expect(offenders(verdict)[0]).toBe(first);
  });

  it('does not count a number word that is part of an amount the scanner read', () => {
    expect(check(['बजट साढ़े सात लाख है।'], LAKH_PLAN).ok).toBe(true);
  });

  it('leaves "one" alone because it is also an ordinary word', () => {
    expect(check(['One of the vendors is still unclear.']).ok).toBe(true);
  });
});

describe('an empty draft', () => {
  it.each<[string, readonly string[]]>([
    ['no lines', []],
    ['blank lines', ['', '   ', '\t']],
  ])('is rejected with %s', (_name, lines) => {
    expect(check(lines)).toEqual({
      ok: false,
      reasons: ['empty'],
      offendingNumbers: [],
      missingQuestionIds: [],
      numbersFound: 0,
      numbersInFacts: 0,
    });
  });
});

describe('the questions a draft must touch', () => {
  const required = reconfirmationQuestionIds(makeFacts());

  it('lists the question ids a draft left out', () => {
    const verdict = check(['We will keep you posted.'], {}, { required });
    expect(verdict).toMatchObject({
      ok: false,
      reasons: ['question-missing'],
      missingQuestionIds: ['guest-count-reconfirmation', 'venue-capacity', 'date-reconfirmation'],
    });
  });

  it('accepts a draft that mentions each topic in English', () => {
    const lines = [
      'The date and guest count changed, so each vendor will confirm.',
      'We will ask the venue about capacity.',
    ];
    expect(check(lines, {}, { required }).ok).toBe(true);
  });

  it('accepts a draft that mentions each topic in Hindi', () => {
    const lines = ['तारीख़ और मेहमानों की गिनती बदली है।', 'हम जगह की क्षमता पूछेंगे।'];
    expect(check(lines, {}, { required, language: 'hi' }).ok).toBe(true);
  });

  it('matches a topic regardless of case', () => {
    expect(check(['GUESTS changed. DATE moved. Venue capacity asked.'], {}, { required }).ok).toBe(
      true,
    );
  });

  it('asks for nothing when a plan has no revision', () => {
    const facts = makeFacts({ before: null });
    expect(reconfirmationQuestionIds(facts)).toEqual([]);
  });

  it('reports both a bad number and a missing question', () => {
    const verdict = check(['Budget Rs 17,00,000.'], {}, { required: ['date-reconfirmation'] });
    expect(verdict).toMatchObject({
      ok: false,
      reasons: ['number-not-in-facts', 'question-missing'],
      missingQuestionIds: ['date-reconfirmation'],
    });
  });
});
