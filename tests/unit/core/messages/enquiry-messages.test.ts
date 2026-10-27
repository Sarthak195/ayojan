import { describe, expect, it } from 'vitest';

import { enquiryTemplates, type EnquiryTemplate } from '@/core/messages/templates';
import { enquiryInput } from '@/core/plan/plan-enquiries';
import { viewOfOps } from '@/core/plan/plan-view';
import type { Language } from '@/core/rupees/format';
import type { Brief } from '@/schemas/plan/brief';
import type { Op } from '@/schemas/plan/op';

import {
  AI_READ,
  BRIEF_OP,
  HINGLISH_BRIEF,
  OVER_BUDGET_QUOTES,
  PLAN_DATA,
  TODAY,
} from '../../../fixtures/plan-readings';
import { date } from './facts-fixture';

const LANGUAGES: readonly Language[] = ['en', 'hi'];

function briefOp(changes: Partial<Brief>): Op {
  return { kind: 'briefConfirmed', brief: { ...HINGLISH_BRIEF, ...changes }, readBy: AI_READ };
}

function enquiries(ops: readonly Op[], language: Language): EnquiryTemplate[] {
  const view = viewOfOps(ops, PLAN_DATA, date(TODAY));
  if (!view.ok) throw new Error('plan refused');
  return enquiryTemplates(enquiryInput(view.value.current, PLAN_DATA), language);
}

function byCategory(list: readonly EnquiryTemplate[], category: string): EnquiryTemplate {
  const found = list.find((enquiry) => enquiry.category === category);
  if (found === undefined) throw new Error(`no enquiry for ${category}`);
  return found;
}

// Every need, diet, limit and must-have at once: the longest message the plan can produce.
const EVERYTHING = briefOp({
  venueCapacity: 250,
  mustHaves: ['dhol', 'mehndiArtist', 'liveCounter', 'choreographer'],
  needs: ['elderly', 'children', 'wheelchair'],
  diet: ['vegOnly', 'jain', 'noAlcohol'],
  venueLimits: ['indoorOnly', 'musicCurfew'],
});

describe('enquiries before any quote', () => {
  it.each(LANGUAGES)('writes one per open vendor category, none with money in it (%s)', (lang) => {
    const list = enquiries([BRIEF_OP], lang);
    expect(list.map((enquiry) => enquiry.category)).toEqual([
      'venue',
      'catering',
      'decor',
      'photo',
      'music',
    ]);
    for (const { text } of list) {
      expect(text).not.toMatch(/\bRs\b|₹|lakh|लाख|[Bb]udget|बजट|8,00,000|800000/);
      // The only numbers are the guest count and the date (26 Feb 2027): nothing invented.
      for (const digits of text.match(/\d+/g) ?? [])
        expect(['200', '26', '2027']).toContain(digits);
    }
  });

  it('skips a category with a quote and one with a booking', () => {
    const booked: Op = {
      kind: 'taskDone',
      taskId: 'book-venue',
      on: TODAY,
      amountInr: 180_000,
      capacity: 220,
    };
    const quoted = OVER_BUDGET_QUOTES.map((quote): Op => ({
      kind: 'quoteAdded',
      quote,
      readBy: AI_READ,
    }));
    const quotedCategories = new Set(OVER_BUDGET_QUOTES.map((quote) => quote.category));
    const list = enquiries([BRIEF_OP, ...quoted, booked], 'en');
    expect(list.map((enquiry) => enquiry.category)).toEqual(['decor', 'music']);
    for (const enquiry of list) {
      expect(enquiry.category).not.toBe('venue');
      expect(quotedCategories.has(enquiry.category)).toBe(false);
      // The booked hall's capacity is a plan fact the other vendors plan around.
      expect(enquiry.text).toContain('Our venue holds up to 220 guests.');
      expect(enquiry.text).not.toMatch(/180|\bRs\b|₹/);
    }
  });

  it('skips a category whose booking task is done without an amount', () => {
    const done: Op = {
      kind: 'taskDone',
      taskId: 'book-venue',
      on: date(TODAY),
      amountInr: null,
      capacity: null,
    };
    const list = enquiries([BRIEF_OP, done], 'en');
    expect(list.map((enquiry) => enquiry.category)).not.toContain('venue');
    expect(list.length).toBe(4);
  });

  it('asks only questions that make sense before a quote, raised by the plan', () => {
    const list = enquiries([BRIEF_OP], 'en');
    const asked = list.flatMap((enquiry) => enquiry.questionIds);
    for (const id of [
      'date-reconfirmation',
      'guest-count-reconfirmation',
      'venue-capacity',
      'guest-cap-exceeded',
      'days-for-per-day',
      'jain-menu',
      'elderly-seating',
      'guests-covered',
      'rate-above-minimum',
    ]) {
      expect(asked).not.toContain(id);
    }
    // Every first enquiry opens with the date; the caterer's minimum comes next, for the
    // others the terms and what the price covers.
    for (const enquiry of list) {
      expect(enquiry.questionIds[0]).toBe('available-on-date');
      expect(enquiry.questionIds.slice(1, 3)).toEqual(
        enquiry.category === 'catering'
          ? ['minimum-guarantee', 'cancellation-terms']
          : ['cancellation-terms', 'price-includes'],
      );
    }
    expect(byCategory(list, 'catering').questionIds).toEqual(
      expect.arrayContaining(['tax-rate', 'minimum-guarantee', 'step-free-access']),
    );
    expect(byCategory(list, 'venue').questionIds).toContain('step-free-access');
    expect(byCategory(list, 'music').text).toContain('We would also like dhol.');
    expect(byCategory(list, 'music').questionIds).not.toContain('dhol-included');
    expect(byCategory(list, 'photo').questionIds).not.toContain('dhol-included');
  });

  it('follows the brief: a Jain diet reaches the caterer only', () => {
    const list = enquiries([briefOp({ diet: ['jain'] })], 'en');
    expect(byCategory(list, 'catering').questionIds).toContain('jain-menu');
    expect(list.filter((enquiry) => enquiry.questionIds.includes('jain-menu'))).toHaveLength(1);
  });

  it.each(LANGUAGES)('states a must-have no question names, and stays short (%s)', (lang) => {
    const list = enquiries([EVERYTHING], lang);
    const mehndi = lang === 'en' ? 'a mehndi artist' : 'मेहंदी लगाने वाले';
    expect(list.filter((enquiry) => enquiry.text.includes(mehndi))).toHaveLength(1);
    for (const enquiry of list) {
      expect(enquiry.questionIds.length).toBeLessThanOrEqual(8);
      expect(Array.from(enquiry.text).length).toBeLessThan(1000);
      expect(enquiry.text).not.toContain('{');
    }
    // The family's own needs are never cut for the general price questions.
    expect(byCategory(list, 'catering').questionIds).toEqual(
      expect.arrayContaining(['live-counter-included', 'jain-menu', 'step-free-access']),
    );
    // With six needs of its own the caterer has room for two general questions: the date, then
    // the per-plate minimum that decides whether quotes can be compared.
    expect(byCategory(list, 'catering').questionIds.slice(0, 2)).toEqual([
      'available-on-date',
      'minimum-guarantee',
    ]);
    expect(byCategory(list, 'catering').questionIds).toContain('minimum-guarantee');
    for (const enquiry of list) expect(enquiry.questionIds[0]).toBe('available-on-date');
    expect(byCategory(list, 'venue').text).not.toContain('250');
    expect(byCategory(list, 'decor').text).not.toContain('250');
  });

  it('asks the same questions in English and Hindi, each in its own language', () => {
    const english = enquiries([EVERYTHING], 'en');
    const hindi = enquiries([EVERYTHING], 'hi');
    expect(hindi.map((enquiry) => enquiry.questionIds)).toEqual(
      english.map((enquiry) => enquiry.questionIds),
    );
    for (const enquiry of hindi) {
      expect(enquiry.text).toMatch(/[ऀ-ॿ]/);
      expect(enquiry.text).not.toContain('Thank you');
      expect(enquiry.label).toBe('टेम्पलेट, आँकड़े आपकी योजना से');
    }
    expect(byCategory(english, 'catering').label).toBe('Template, numbers from your plan');
  });
});
