// The shapes shared by every quote module (architecture 4.7). A comparable total is a
// three-way answer, never a number that might be a silent zero: it is either a total, a
// lump sum that no longer covers the guests, or unclear with the questions that would settle it.

import type { QuoteSlot } from '@/schemas/plan/quote-record';
import type { MustHave } from '@/schemas/readings/vocabulary';

import type { Money, MoneyRefusal } from '../money/money';

/** Why a quote is incomplete. The first five have a question in data/vendor-questions.yaml. */
export type QuoteGap =
  | 'basis'
  | 'rate'
  | 'days'
  | 'minimumGuests'
  | 'rateAboveMinimum'
  | 'guestsCovered'
  | 'taxRate'
  | 'liveCounter';

export type QuoteRefusal = MoneyRefusal | 'guests-out-of-range';

export type QuoteResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: QuoteRefusal };

export function accepted<T>(value: T): QuoteResult<T> {
  return { ok: true, value };
}

export function refused<T>(reason: QuoteRefusal): QuoteResult<T> {
  return { ok: false, reason };
}

/** What the plan needs from a vendor beyond the base price, taken from the brief's must-haves. */
export interface PlanRequirements {
  readonly liveCounterRequired: boolean;
}

export function requirementsFrom(mustHaves: readonly MustHave[]): PlanRequirements {
  return { liveCounterRequired: mustHaves.includes('liveCounter') };
}

/** `added` carries an amount; the other three leave the total without tax. */
export type TaxKind = 'included' | 'added' | 'rate-not-stated' | 'unclear';

export interface TaxOutcome {
  readonly kind: TaxKind;
  readonly basisPoints: number | null;
  readonly amount: Money | null;
}

export interface CountedExtra {
  readonly key: 'liveCounter' | 'other';
  readonly label: string;
  readonly amount: Money | null;
  /** Only an extra the plan requires is added to the total; the rest are shown, not charged. */
  readonly counted: boolean;
}

interface TotalBase {
  readonly quoteId: QuoteSlot;
  readonly guests: number;
  readonly gaps: readonly QuoteGap[];
}

export interface ComparableAmount extends TotalBase {
  readonly status: 'comparable';
  /** Plates charged for a per-plate quote (the minimum can bind); null for a lump sum. */
  readonly billedPlates: number | null;
  readonly base: Money;
  readonly extras: readonly CountedExtra[];
  readonly beforeTax: Money;
  readonly tax: TaxOutcome;
  /** Before tax plus any tax that was added; from-quote provenance. */
  readonly total: Money;
  /** True when the rate is unstated or unclear, so the total excludes a tax that may apply. */
  readonly plusGstRateNotStated: boolean;
}

/** A lump sum is never scaled: above its cap the vendor must quote again. */
export interface CapExceeded extends TotalBase {
  readonly status: 'cap-exceeded';
  readonly cap: number;
}

export interface Unclear extends TotalBase {
  readonly status: 'unclear';
}

export type ComparableTotal = ComparableAmount | CapExceeded | Unclear;
