import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkDraft } from '@/core/messages/draft-check';
import type { MessageFacts, MessageFactsInput } from '@/core/messages/fact-types';
import { buildMessageFacts, reconfirmationQuestionIds } from '@/core/messages/message-facts';
import { modelFacts } from '@/core/messages/model-facts';
import { LeverId, QuestionId, TaskId } from '@/schemas/generated/ids';
import { Diet, Occasion, VenueLimit } from '@/schemas/readings/vocabulary';

import { dataQuestions, makeFacts } from './facts-fixture';

// The enum values a model could echo: any of them as a whole value, or a hyphenated id anywhere,
// is an id reaching the model ("step-free-access" once came back as स्टेप-फ्री-एक्सेस).
const IDS: readonly string[] = [
  ...QuestionId.options,
  ...LeverId.options,
  ...TaskId.options,
  ...Occasion.options,
  ...Diet.options,
  ...VenueLimit.options,
  ...['taxRate', 'minimumGuests', 'guestsCovered', 'rateAboveMinimum', 'days'],
  ...['atRisk', 'late', 'today', 'after', 'on'],
];
const HYPHENATED_IDS = IDS.filter((id) => id.includes('-'));
// "wedding" or "today" is also the English word itself; only a coined id is a leak on its own.
const CODED_IDS = IDS.filter((id) => /[-A-Z]/u.test(id));

function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(stringsIn);
}

function fixtureFacts(): MessageFacts {
  const raw = readFileSync(join(process.cwd(), 'fixtures', 'family-update-facts.json'), 'utf8');
  return buildMessageFacts(JSON.parse(raw) as MessageFactsInput);
}

const CASES = [
  ['the hand-pinned facts', makeFacts()],
  ['the recorded fixture', fixtureFacts()],
] as const;

describe('modelFacts', () => {
  for (const [name, facts] of CASES) {
    for (const language of ['en', 'hi'] as const) {
      it(`sends no internal id for ${name} in ${language}`, () => {
        const values = stringsIn(modelFacts(facts, dataQuestions(), language));
        expect(values.length).toBeGreaterThan(0);
        for (const value of values) {
          expect(CODED_IDS).not.toContain(value);
          for (const id of HYPHENATED_IDS) expect(value).not.toContain(id);
          if (language === 'hi') expect(value).not.toMatch(/[A-Za-z]+-[A-Za-z]+/u);
        }
      });
    }
  }

  it('words every follow-up as the vendor is asked it, in the page language', () => {
    const sent = modelFacts(makeFacts(), dataQuestions(), 'hi') as {
      vendors: { vendor: string; questions: string[] }[];
      mustMention: string[];
    };
    expect(sent.vendors[0]?.vendor).toBe('कैटरर A');
    expect(sent.vendors[0]?.questions).toContain(
      'हमारे मेहमान अब 250 हैं। क्या आपकी क़ीमत बदलेगी?',
    );
    expect(sent.mustMention).toHaveLength(reconfirmationQuestionIds(makeFacts()).length);
    expect(sent.mustMention).toContain('मेहमान');
  });

  // The rule asks the draft to copy the date and the guest count; the check must count both (day,
  // year and guests: the month is a word).
  for (const language of ['en', 'hi'] as const) {
    it(`a draft copying now.eventDate and now.guests passes the check in ${language}`, () => {
      const facts = makeFacts();
      const { now } = modelFacts(facts, dataQuestions(), language) as {
        now: { eventDate: string; guests: number };
      };
      const verdict = checkDraft({
        lines: [`${now.eventDate}: ${String(now.guests)}`],
        facts,
        language,
        requiredQuestionIds: [],
      });
      expect(verdict).toMatchObject({ ok: true, numbersFound: 3 });
    });
  }
});
