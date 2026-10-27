import type { IsoDate } from '@/core/calendar/day-number';
import { parseIsoDate } from '@/core/calendar/day-number';
import type { MessageFacts, MessageFactsInput } from '@/core/messages/fact-types';
import { buildMessageFacts } from '@/core/messages/message-facts';
import type { QuestionText } from '@/core/messages/vendor-messages';
import { knowledge } from '@/server/knowledge/repository';

export function date(text: string): IsoDate {
  const parsed = parseIsoDate(text);
  if (!parsed.ok) throw new Error(`bad test date ${text}`);
  return parsed.value;
}

function failFixture(name: string): never {
  throw new Error(`fixture is missing the ${name}`);
}

// Pinned by hand: a plan whose date moved two weeks earlier, 30 guests fewer, and whose
// budget rose by Rs 1,00,000 (the probe's example change, 03-gemini-probe).
export const REVISED: MessageFactsInput = {
  occasion: 'wedding',
  now: {
    budgetInr: 1_500_000,
    guests: 250,
    eventDate: date('2026-12-12'),
    projectedInr: 1_650_000,
    priced: true,
  },
  before: {
    budgetInr: 1_400_000,
    guests: 280,
    eventDate: date('2026-12-26'),
    projectedInr: 1_600_000,
    priced: true,
  },
  daysToEvent: 47,
  levers: [
    { id: 'simpler-decor', label: { en: 'Simpler decor', hi: 'सादी सजावट' }, effectInr: 45_000 },
  ],
  atRisk: [
    {
      taskId: 'print-invitations',
      name: { en: 'Print invitations', hi: 'निमंत्रण छपवाना' },
      status: 'late',
      dueBy: date('2026-11-20'),
    },
  ],
  vendors: [
    {
      label: { en: 'Caterer A', hi: 'कैटरर A' },
      category: 'catering',
      questionIds: ['guest-count-reconfirmation', 'tax-rate'],
      bookedCapacity: null,
    },
    {
      label: { en: 'Venue', hi: 'वेन्यू' },
      category: 'venue',
      questionIds: ['venue-capacity', 'date-reconfirmation'],
      bookedCapacity: 220,
    },
  ],
  unclearQuotes: [{ vendor: { en: 'Caterer A', hi: 'कैटरर A' }, fields: ['taxRate'] }],
  diet: ['vegOnly'],
  venueLimits: ['indoorOnly'],
};

export const CATERER = REVISED.vendors[0] ?? failFixture('caterer');
export const VENUE = REVISED.vendors[1] ?? failFixture('venue');

export const UNCLEAR = REVISED.unclearQuotes[0] ?? failFixture('unclear quote');

export function makeFacts(overrides: Partial<MessageFactsInput> = {}): MessageFacts {
  return buildMessageFacts({ ...REVISED, ...overrides });
}

/** The real question rows, so the tests read the wording from the data, not from a copy. */
export function dataQuestions(): readonly QuestionText[] {
  return knowledge().get('vendorQuestions').questions;
}

export function questionRow(id: string): QuestionText {
  const row = dataQuestions().find((candidate) => candidate.id === id);
  if (row === undefined) throw new Error(`no question ${id} in the data`);
  return row;
}
