import { join } from 'node:path';

import type { QuoteRecord } from '@/schemas/plan/quote-record';
import { createKnowledgeRepository, readFromDirectory } from '@/server/knowledge/repository';

import type {
  ComparableAmount,
  ComparableTotal,
  PlanRequirements,
} from '@/core/quotes/quote-types';
import { comparableTotal } from '@/core/quotes/comparable-total';

// The real draft data, so a question or lever the tests read breaks when the data changes.
const documents = createKnowledgeRepository(readFromDirectory(join(process.cwd(), 'data'))).all();
export const questionRows = documents.vendorQuestions.questions;

export const NO_NEEDS: PlanRequirements = { liveCounterRequired: false };
export const LIVE_COUNTER_NEEDED: PlanRequirements = { liveCounterRequired: true };

const BLANK: QuoteRecord = {
  id: 'A',
  category: 'catering',
  basis: 'perPlate',
  rateInr: 1300,
  minimumGuests: 200,
  guestsCovered: null,
  tax: 'included',
  taxBasisPoints: null,
  extras: [],
  inclusions: [],
  advancePercent: null,
};

export function quote(overrides: Partial<QuoteRecord> = {}): QuoteRecord {
  return { ...BLANK, ...overrides };
}

const LIVE_COUNTER = {
  key: 'liveCounter',
  label: 'Live chaat counter',
  amountInr: 15_000,
} as const;

// The spec's Caterer A (5.2): Rs 1,300 a plate, minimum 200, GST extra with no rate stated,
// a live counter at Rs 15,000 extra and 30 percent advance.
export const CATERER_A: QuoteRecord = quote({
  id: 'A',
  tax: 'extraRateUnstated',
  extras: [LIVE_COUNTER],
  inclusions: ['2 sweets'],
  advancePercent: 30,
});

// The spec's Caterer B (5.2): Rs 3,00,000 lump sum for up to 250 guests, GST included.
export const CATERER_B: QuoteRecord = quote({
  id: 'B',
  basis: 'lumpSum',
  rateInr: 300_000,
  minimumGuests: null,
  guestsCovered: 250,
  tax: 'included',
  extras: [LIVE_COUNTER],
});

export function totalOf(
  record: QuoteRecord,
  guests: number,
  needs: PlanRequirements = NO_NEEDS,
): ComparableTotal {
  const result = comparableTotal(record, guests, needs);
  if (!result.ok) throw new Error(`The test quote was refused: ${result.reason}`);
  return result.value;
}

export function amountOf(
  record: QuoteRecord,
  guests: number,
  needs: PlanRequirements = NO_NEEDS,
): ComparableAmount {
  const total = totalOf(record, guests, needs);
  if (total.status !== 'comparable')
    throw new Error(`Expected a comparable total: ${total.status}`);
  return total;
}
