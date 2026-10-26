import { parseIsoDate, type IsoDate } from '@/core/calendar/day-number';
import { canonicalise } from '@/core/grounding/canonical-text';
import type { BriefReading } from '@/schemas/readings/brief-reading';
import type { ChangeReading } from '@/schemas/readings/change-reading';
import type { QuoteReading } from '@/schemas/readings/quote-reading';
import { createExampleBook, type ExampleBook } from '@/server/pipeline/example-readings';
import type { ReadingKind } from '@/server/pipeline/schema-versions';
import * as brief from '@/server/prompts/brief';
import * as quote from '@/server/prompts/quote';
import { fakeLlmGateway, type FakeReply } from '../../../fakes/llm-gateway';

export function date(text: string): IsoDate {
  const parsed = parseIsoDate(text);
  if (!parsed.ok) throw new Error(`bad test date ${text}`);
  return parsed.value;
}

/** The golden "today" of the change test (12 section 4.4). */
export const TODAY = date('2026-10-31');

export const NO_EXAMPLES: ExampleBook = createExampleBook([]);

export function gatewayAnswering(
  promptId: string,
  reply: FakeReply,
): ReturnType<typeof fakeLlmGateway> {
  return fakeLlmGateway(new Map([[promptId, reply]]));
}

// Spec 5.1, the Hinglish sample brief.
export const HINGLISH =
  'Bhai ki shaadi Indore mein, budget 8 lakh, lagbhag 200 log, Feb end mein. Khana sabse important, decoration simple rakhna. Dhol must hai. Haldi aur mehndi ghar pe chhote functions. Nani wheelchair use karti hain.';

export function briefReading(overrides: Partial<BriefReading> = {}): BriefReading {
  return {
    occasion: { value: 'unclear', quote: '' },
    budget: { presence: 'absent', amountInr: null, quote: '' },
    guests: { presence: 'absent', count: null, quote: '' },
    venueCapacity: { presence: 'absent', count: null, quote: '' },
    date: { presence: 'absent', day: null, month: null, year: null, quote: '' },
    functions: [],
    priorities: [],
    mustHaves: [],
    guestNeeds: [],
    diet: [],
    venueLimits: [],
    otherMustHaves: [],
    otherNeeds: [],
    ...overrides,
  };
}

export const HINGLISH_READING: BriefReading = briefReading({
  occasion: { value: 'wedding', quote: 'Bhai ki shaadi' },
  budget: { presence: 'present', amountInr: 800_000, quote: 'budget 8 lakh' },
  guests: { presence: 'present', count: 200, quote: 'lagbhag 200 log' },
  date: { presence: 'unclear', day: null, month: null, year: null, quote: 'Feb end mein' },
  functions: [
    { name: 'haldi', presence: 'present', quote: 'Haldi aur mehndi ghar pe chhote functions' },
    { name: 'mehndi', presence: 'present', quote: 'Haldi aur mehndi ghar pe chhote functions' },
    { name: 'wedding', presence: 'present', quote: 'Bhai ki shaadi' },
  ],
  priorities: [
    { category: 'catering', level: 'more', quote: 'Khana sabse important' },
    { category: 'decor', level: 'save', quote: 'decoration simple rakhna' },
  ],
  mustHaves: [{ item: 'dhol', quote: 'Dhol must hai' }],
  guestNeeds: [
    { need: 'wheelchair', presence: 'present', quote: 'Nani wheelchair use karti hain' },
  ],
});

// 12 section 5.1, quote-caterer-a.
export const CATERER_A =
  '1300/plate veg, min 200 plate, GST extra, 2 sweet incl, live chaat counter 15k alag, advance 30%';

export function quoteReading(overrides: Partial<QuoteReading> = {}): QuoteReading {
  return {
    category: { value: 'unclear', quote: '' },
    basis: { value: 'unclear', quote: '' },
    rateInr: { amountInr: null, quote: '' },
    minimumGuests: { presence: 'absent', count: null, quote: '' },
    guestsCovered: { presence: 'absent', count: null, quote: '' },
    tax: { value: 'absent', ratePercent: null, quote: '' },
    inclusions: [],
    extras: [],
    advancePercent: { presence: 'absent', percent: null, quote: '' },
    ...overrides,
  };
}

export const CATERER_A_READING: QuoteReading = quoteReading({
  category: { value: 'catering', quote: '1300/plate veg' },
  basis: { value: 'perPlate', quote: '1300/plate' },
  rateInr: { amountInr: 1300, quote: '1300/plate' },
  minimumGuests: { presence: 'present', count: 200, quote: 'min 200 plate' },
  tax: { value: 'extraRateUnstated', ratePercent: null, quote: 'GST extra' },
  inclusions: [{ label: '2 sweets', amountInr: null, quote: '2 sweet incl' }],
  extras: [
    { label: 'live chaat counter', amountInr: 15_000, quote: 'live chaat counter 15k alag' },
  ],
  advancePercent: { presence: 'present', percent: 30, quote: 'advance 30%' },
});

export function changeReading(overrides: Partial<ChangeReading> = {}): ChangeReading {
  return {
    guests: { mode: 'absent', count: null, quote: '' },
    budget: { mode: 'absent', direction: 'none', amountInr: null, quote: '' },
    dateShift: { presence: 'absent', shiftDays: null, quote: '' },
    dateWritten: { presence: 'absent', day: null, month: null, year: null, quote: '' },
    reallocate: { presence: 'absent', to: 'unclear', amountInr: null, quote: '' },
    ...overrides,
  };
}

const PROMPTS = { brief, quote } as const;

/** A book holding one recording for `text`, as record-golden.ts would have written it. */
export function bookWith(
  kind: Exclude<ReadingKind, 'change'>,
  text: string,
  reply: unknown,
  recordedOn = '2026-10-27',
): ExampleBook {
  return createExampleBook([
    {
      kind,
      canonicalText: canonicalise(text).text,
      recording: {
        promptId: PROMPTS[kind].id,
        promptVersion: PROMPTS[kind].version,
        schemaVersion: '1',
        answeredBy: 'gemini-3.5-flash-lite',
        recordedOn,
        reply,
      },
    },
  ]);
}
