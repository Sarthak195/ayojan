// Finds rupee amounts in free text: "8 lakh", "8L", "800k", "1,90,000/-", "50 hazaar",
// "dedh lakh", Devanagari digits and words. The caller (grounding) accepts a model's number
// only if it appears among these amounts, so the scanner must be both strict (never invent
// a figure) and fast (a pasted wall of text must not stall a request): it is a single
// left-to-right pass, every helper only moves forward, and there is no regex at all.
// Currency markers (Rs, INR, the rupee sign, a trailing "/-") need no handling: they are
// ordinary non-amount characters that the scan steps over.

import { digitValue, readNumber } from './number-token';
import {
  isWordCharacter,
  lookupAttachedUnit,
  lookupNumeral,
  lookupPrefix,
  lookupQuantity,
  lookupUnit,
  normalizeWord,
  readWord,
  skipBlanks,
} from './number-words';

export type UnusableReason = 'too-large' | 'fractional';

export type ScanHit =
  | { readonly kind: 'amount'; readonly inr: number; readonly start: number; readonly end: number }
  | {
      readonly kind: 'unusable';
      readonly reason: UnusableReason;
      readonly start: number;
      readonly end: number;
    };

export type UnclearReason = 'empty' | 'no-amount' | 'several-amounts' | UnusableReason;

export type ParsedAmount =
  | { readonly kind: 'amount'; readonly inr: number }
  | { readonly kind: 'unclear'; readonly reason: UnclearReason };

// Beyond 15 significant digits a plain number cannot be a plausible rupee figure and
// would risk leaving the safe-integer range after a unit multiplier.
const MAX_SIGNIFICANT_DIGITS = 15;
const MAX_FRACTION_DIGITS = 12;
const MAX_AMOUNT = BigInt(Number.MAX_SAFE_INTEGER);

function stripLeadingZeros(digits: string): string {
  let index = 0;
  while (index < digits.length - 1 && digits.charAt(index) === '0') index += 1;
  return digits.slice(index);
}

function stripTrailingZeros(digits: string): string {
  let end = digits.length;
  while (end > 0 && digits.charAt(end - 1) === '0') end -= 1;
  return digits.slice(0, end);
}

/** Exact rupees for `integer.fraction` times `multiplier`, using integers only. */
function exactRupees(
  integer: string,
  fraction: string,
  multiplier: number,
  start: number,
  end: number,
): ScanHit {
  const whole = stripLeadingZeros(integer);
  const decimals = stripTrailingZeros(fraction);
  if (whole.length > MAX_SIGNIFICANT_DIGITS)
    return { kind: 'unusable', reason: 'too-large', start, end };
  if (decimals.length > MAX_FRACTION_DIGITS)
    return { kind: 'unusable', reason: 'fractional', start, end };
  const scaled = BigInt(whole + decimals) * BigInt(multiplier);
  const divisor = 10n ** BigInt(decimals.length);
  if (scaled % divisor !== 0n) return { kind: 'unusable', reason: 'fractional', start, end };
  const rupees = scaled / divisor;
  if (rupees > MAX_AMOUNT) return { kind: 'unusable', reason: 'too-large', start, end };
  return { kind: 'amount', inr: Number(rupees), start, end };
}

interface Scanned {
  readonly hit: ScanHit | null;
  readonly next: number;
}

function wordAt(text: string, start: number): { word: string; end: number } {
  const end = readWord(text, start);
  return { word: normalizeWord(text.slice(start, end)), end };
}

function scanNumeric(text: string, start: number): Scanned {
  const token = readNumber(text, start);
  const attached = isWordCharacter(text.charCodeAt(token.end));
  const unitStart = attached ? token.end : skipBlanks(text, token.end);
  if (isWordCharacter(text.charCodeAt(unitStart))) {
    const { word, end } = wordAt(text, unitStart);
    const unit = attached ? lookupAttachedUnit(word) : lookupUnit(word);
    if (unit !== undefined) {
      return { hit: exactRupees(token.integer, token.fraction, unit, start, end), next: end };
    }
  }
  return { hit: exactRupees(token.integer, token.fraction, 1, start, token.end), next: token.end };
}

// The whole number after "saadhe" or "paune": a numeral word or plain digits ("saadhe 3 lakh").
function readWholeAfterPrefix(text: string, start: number): { value: number; end: number } | null {
  if (digitValue(text.charCodeAt(start)) >= 0) {
    const token = readNumber(text, start);
    const whole = stripLeadingZeros(token.integer);
    if (token.fraction !== '' || whole.length > 6) return null;
    return { value: Number(whole), end: token.end };
  }
  if (!isWordCharacter(text.charCodeAt(start))) return null;
  const { word, end } = wordAt(text, start);
  const value = lookupNumeral(word);
  return value === undefined ? null : { value, end };
}

function quartersHit(
  quarters: number,
  unitStart: number,
  text: string,
  start: number,
): Scanned | null {
  if (quarters <= 0 || !isWordCharacter(text.charCodeAt(unitStart))) return null;
  const { word, end } = wordAt(text, unitStart);
  const unit = lookupUnit(word);
  if (unit === undefined) return null;
  // Every unit is divisible by four, so quarters of it are whole rupees.
  return { hit: exactRupees(String(quarters), '', unit / 4, start, end), next: end };
}

function scanHindiWords(text: string, start: number): Scanned {
  const first = wordAt(text, start);
  const skip: Scanned = { hit: null, next: first.end };
  const quantity = lookupQuantity(first.word);
  if (quantity !== undefined) {
    return quartersHit(quantity.quarters, skipBlanks(text, first.end), text, start) ?? skip;
  }
  const prefix = lookupPrefix(first.word);
  if (prefix === undefined) return skip;
  const whole = readWholeAfterPrefix(text, skipBlanks(text, first.end));
  if (whole === null) return skip;
  const quarters = whole.value * 4 + prefix.offsetQuarters;
  return quartersHit(quarters, skipBlanks(text, whole.end), text, start) ?? skip;
}

/** Every amount in `text`, in order, with its position. Unreadable ones are reported as such. */
export function scanAmounts(text: string): ScanHit[] {
  const hits: ScanHit[] = [];
  let index = 0;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (digitValue(code) >= 0) {
      const scanned = scanNumeric(text, index);
      if (scanned.hit !== null) hits.push(scanned.hit);
      index = scanned.next;
    } else if (isWordCharacter(code)) {
      const scanned = scanHindiWords(text, index);
      if (scanned.hit !== null) hits.push(scanned.hit);
      index = scanned.next;
    } else {
      index += 1;
    }
  }
  return hits;
}

/** The distinct whole-rupee values found in `text`, for "is the model's number in its quote". */
export function amountsIn(text: string): number[] {
  const values = new Set<number>();
  for (const hit of scanAmounts(text)) {
    if (hit.kind === 'amount') values.add(hit.inr);
  }
  return [...values];
}

/** Reads text that is meant to be exactly one amount; anything else is unclear, never guessed. */
export function parseAmount(text: string): ParsedAmount {
  if (text.trim() === '') return { kind: 'unclear', reason: 'empty' };
  const [only, ...others] = scanAmounts(text);
  if (only === undefined) return { kind: 'unclear', reason: 'no-amount' };
  if (others.length > 0) return { kind: 'unclear', reason: 'several-amounts' };
  return only.kind === 'amount'
    ? { kind: 'amount', inr: only.inr }
    : { kind: 'unclear', reason: only.reason };
}
