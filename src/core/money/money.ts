// Every rupee figure the app shows is a Money, so a figure without a provenance label
// cannot type-check (spec section 7). Amounts are whole rupees: paise never enter the
// plan, which keeps every sum exact and every golden file stable.

export type Provenance = 'your-number' | 'your-split' | 'from-quote' | 'computed' | 'assumption';

export interface Money {
  readonly inr: number;
  readonly provenance: Provenance;
}

export type MoneyRefusal = 'not-a-number' | 'not-whole-rupees' | 'out-of-range' | 'bad-divisor';

export type MoneyResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: MoneyRefusal };

export function refuse<T>(reason: MoneyRefusal): MoneyResult<T> {
  return { ok: false, reason };
}

export function accept<T>(value: T): MoneyResult<T> {
  return { ok: true, value };
}

/** Classifies a candidate rupee count; null means it is a usable whole number of rupees. */
export function refusalFor(inr: number): MoneyRefusal | null {
  if (Number.isNaN(inr)) return 'not-a-number';
  if (!Number.isFinite(inr)) return 'out-of-range';
  if (!Number.isInteger(inr)) return 'not-whole-rupees';
  // Beyond 2^53 an integer is no longer exact, so a sum could silently drop rupees.
  if (!Number.isSafeInteger(inr)) return 'out-of-range';
  return null;
}

// Signed on purpose: a gap or a difference is negative when the plan is over budget
// (FR-9 renders it with a minus). Callers that need a non-negative amount, such as the
// rounding rule, refuse negatives themselves.
export function money(inr: number, provenance: Provenance): MoneyResult<Money> {
  const refusal = refusalFor(inr);
  return refusal === null ? accept({ inr, provenance }) : refuse(refusal);
}

// Arithmetic over amounts is `computed` even when every input shares a provenance,
// because the result is no longer something the user typed or a data percentage.
export function sum(amounts: readonly Money[]): MoneyResult<Money> {
  let total = 0;
  for (const amount of amounts) {
    total += amount.inr;
    // Checking each step stops a transient overflow from being masked by a later negative.
    if (!Number.isSafeInteger(total)) return refuse('out-of-range');
  }
  return money(total, 'computed');
}

export function difference(minuend: Money, subtrahend: Money): MoneyResult<Money> {
  return money(minuend.inr - subtrahend.inr, 'computed');
}

/**
 * Integer division rounded half up, that is toward positive infinity on a tie:
 * 5/2 gives 3 and -5/2 gives -2. One direction for both signs keeps scale(-x) and
 * scale(x) a mirror pair except exactly on ties, and it needs no sign special-casing.
 * BigInt keeps `numerator` times a large amount exact where doubles would round.
 */
export function divideRoundHalfUp(numerator: number, divisor: number): MoneyResult<number> {
  const refusal = refusalFor(numerator);
  if (refusal !== null) return refuse(refusal);
  if (!Number.isSafeInteger(divisor) || divisor <= 0) return refuse('bad-divisor');
  return fromBigInt(halfUpQuotient(BigInt(numerator), BigInt(divisor)));
}

export function scale(amount: Money, numerator: number, denominator: number): MoneyResult<Money> {
  const refusal = refusalFor(numerator);
  if (refusal !== null) return refuse(refusal);
  if (!Number.isSafeInteger(denominator) || denominator <= 0) return refuse('bad-divisor');
  const product = BigInt(amount.inr) * BigInt(numerator);
  const scaled = fromBigInt(halfUpQuotient(product, BigInt(denominator)));
  return scaled.ok ? money(scaled.value, 'computed') : scaled;
}

function halfUpQuotient(numerator: bigint, divisor: bigint): bigint {
  const twice = 2n * numerator + divisor;
  const floor = twice / (2n * divisor);
  // BigInt division truncates toward zero, so a negative inexact quotient is one too high.
  return twice < 0n && twice % (2n * divisor) !== 0n ? floor - 1n : floor;
}

function fromBigInt(value: bigint): MoneyResult<number> {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > limit || value < -limit) return refuse('out-of-range');
  return accept(Number(value));
}
