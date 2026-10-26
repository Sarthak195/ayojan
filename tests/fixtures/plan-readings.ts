// Hand-made confirmed readings for the golden plan tests: what the check screen would hold
// after the family confirmed each reading of spec 5.2 and 5.3. No model is called; the values
// are the spec's own, typed in by hand, and every quote below is the spec's wording.

import { join } from 'node:path';

import type { PlanData } from '@/core/plan/plan-data';
import type { Brief, ReadBy } from '@/schemas/plan/brief';
import type { Op } from '@/schemas/plan/op';
import type { QuoteRecord } from '@/schemas/plan/quote-record';
import type { ChangeReading } from '@/schemas/readings/change-reading';
import type { Category, Priority } from '@/schemas/readings/vocabulary';
import { createKnowledgeRepository, readFromDirectory } from '@/server/knowledge/repository';

const documents = createKnowledgeRepository(readFromDirectory(join(process.cwd(), 'data'))).all();

/** The real draft data, so a changed weight or lead time shows up as a golden diff. */
export const PLAN_DATA: PlanData = {
  budgetWeights: documents.budgetWeights,
  tasks: documents.tasks,
  levers: documents.levers,
  vendorQuestions: documents.vendorQuestions,
};

export const TODAY = '2026-10-31';

export const AI_READ: ReadBy = {
  source: 'ai',
  model: 'gemini-3.5-flash-lite',
  matched: 9,
  total: 9,
};

export const FORM_READ: ReadBy = { source: 'form', model: null, matched: 0, total: 0 };

// Only food and decor were named; the other rows stay unanswered, which the split treats as
// standard (D15) and the check screen shows as "not sure yet".
export const SPEC_PRIORITIES: Record<Category, Priority> = {
  venue: 'unclear',
  catering: 'more',
  decor: 'save',
  photo: 'unclear',
  music: 'unclear',
  invites: 'unclear',
  contingency: 'unclear',
};

// Spec 5.1 step 2, as confirmed on the check screen with 26 Feb 2027 picked for "Feb end mein".
export const HINGLISH_BRIEF: Brief = {
  occasion: 'wedding',
  budgetInr: 800_000,
  guests: 200,
  eventDate: '2027-02-26',
  venueCapacity: null,
  functions: { haldi: 'yes', mehndi: 'yes', sangeet: 'unsure', wedding: 'yes', reception: 'unsure' },
  priorities: SPEC_PRIORITIES,
  mustHaves: ['dhol'],
  needs: ['wheelchair'],
  diet: [],
  venueLimits: [],
  notes: [],
};

export const BRIEF_OP: Op = { kind: 'briefConfirmed', brief: HINGLISH_BRIEF, readBy: AI_READ };

const LIVE_COUNTER = { key: 'liveCounter', label: 'Live chaat counter', amountInr: 15_000 } as const;

// "1300/plate, min 200 plate, GST extra, live chaat counter 15k alag, 30% advance".
export const CATERER_A: QuoteRecord = {
  id: 'A',
  category: 'catering',
  basis: 'perPlate',
  rateInr: 1_300,
  minimumGuests: 200,
  guestsCovered: null,
  tax: 'extraRateUnstated',
  taxBasisPoints: null,
  extras: [LIVE_COUNTER],
  inclusions: [],
  advancePercent: 30,
};

// "3 lakh lump sum for up to 250 guests, GST included, live counter 15k extra".
export const CATERER_B: QuoteRecord = {
  id: 'B',
  category: 'catering',
  basis: 'lumpSum',
  rateInr: 300_000,
  minimumGuests: null,
  guestsCovered: 250,
  tax: 'included',
  taxBasisPoints: null,
  extras: [LIVE_COUNTER],
  inclusions: [],
  advancePercent: null,
};

// The explainer's sentence [27:53-28:20], read as spec 5.2 step 2 says it is.
export const EXPLAINER_SENTENCE =
  'we have got 50 more guests now, our budget has decreased a bit, and the event is happening 2 weeks earlier';

export const EXPLAINER_READING: ChangeReading = {
  guests: { mode: 'delta', count: 50, quote: '50 more guests' },
  budget: {
    mode: 'directionOnly',
    direction: 'decrease',
    amountInr: null,
    quote: 'our budget has decreased a bit',
  },
  dateShift: { presence: 'present', shiftDays: -14, quote: '2 weeks earlier' },
  dateWritten: { presence: 'absent', day: null, month: null, year: null, quote: '' },
  reallocate: { presence: 'absent', to: 'unclear', amountInr: null, quote: '' },
};

// "photography pe 50 hazaar aur": the Hinglish Move money fixture of FR-23 and FR-28.
export const HINGLISH_REALLOCATION: ChangeReading = {
  guests: { mode: 'absent', count: null, quote: '' },
  budget: { mode: 'absent', direction: 'none', amountInr: null, quote: '' },
  dateShift: { presence: 'absent', shiftDays: null, quote: '' },
  dateWritten: { presence: 'absent', day: null, month: null, year: null, quote: '' },
  reallocate: {
    presence: 'present',
    to: 'photo',
    amountInr: 50_000,
    quote: 'photography pe 50 hazaar aur',
  },
};

// Spec 5.3: a fresh 8 lakh, 200 guest plan with the same priorities and three quotes.
export const OVER_BUDGET_QUOTES: readonly QuoteRecord[] = [
  {
    ...CATERER_B,
    id: 'A',
    category: 'venue',
    rateInr: 250_000,
    guestsCovered: 200,
    extras: [],
  },
  {
    ...CATERER_A,
    id: 'B',
    rateInr: 1_800,
    tax: 'included',
    extras: [],
    advancePercent: null,
  },
  {
    ...CATERER_B,
    id: 'C',
    category: 'photo',
    rateInr: 120_000,
    guestsCovered: 200,
    extras: [],
  },
];
