// Rupee formatting written by hand (D1, D30). Intl.NumberFormat('en-IN') depends on the ICU
// data bundled with each Node build and browser, so the same amount could print
// differently in a golden test and on a phone. Plain string arithmetic is identical
// everywhere. English and Hindi share one amount format ("Rs 7,50,000", Western digits)
// because the rupee sign may not render on old phone fonts; only the unit words differ.

export type Language = 'en' | 'hi';

const LAKH = 100_000;
const CRORE = 10_000_000;
const TENTHS_OF_A_CRORE_IN_LAKH_TENTHS = 1_000;

// The crore word carries its nukta as the canonical decomposed pair (U+0921 U+093C), the
// form NFC produces and the scanner normalises to, so output compares equal to normalised text.
const LAKH_WORD: Record<Language, string> = { en: 'lakh', hi: 'लाख' };
const CRORE_WORD: Record<Language, string> = {
  en: 'crore',
  hi: 'करोड़',
};

/** Groups the digits of a non-negative integer as 12,34,56,789: three, then pairs. */
export function groupIndian(value: number): string {
  const digits = String(value);
  if (digits.length <= 3) return digits;
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const pairs: string[] = [];
  for (let end = rest.length; end > 0; end -= 2) {
    pairs.unshift(rest.slice(Math.max(0, end - 2), end));
  }
  return `${pairs.join(',')},${lastThree}`;
}

function isFormattable(inr: number): boolean {
  return Number.isSafeInteger(inr);
}

/**
 * "Rs 7,50,000" in both languages; a negative amount keeps its minus in front ("-Rs 1,20,000")
 * so an under-budget figure reads as a deficit. Input that did not come from a Money (a
 * fraction, NaN) prints a visible "Rs ?" rather than a plausible wrong figure.
 */
export function formatRupees(inr: number): string {
  if (!isFormattable(inr)) return 'Rs ?';
  const sign = inr < 0 ? '-' : '';
  return `${sign}Rs ${groupIndian(Math.abs(inr))}`;
}

// Tenths of a unit, half up on the magnitude, so 7.45 lakh is "7.5" and -7.45 lakh is
// "-7.5" (symmetric: the sign is attached after rounding, not folded into it).
// Quotient and remainder instead of multiplying first, so no intermediate leaves 2^53.
function tenthsOf(magnitude: number, unit: number): number {
  const step = unit / 10;
  const quotient = Math.floor(magnitude / step);
  const remainder = magnitude - quotient * step;
  return remainder * 2 >= step ? quotient + 1 : quotient;
}

function withDecimal(tenths: number): string {
  const whole = groupIndian(Math.floor(tenths / 10));
  const decimal = tenths % 10;
  return decimal === 0 ? whole : `${whole}.${String(decimal)}`;
}

/**
 * A short word form for large amounts: "7.5 lakh", "1.2 crore" and the Hindi equivalents.
 * It is a reading aid beside the exact figure, rounded to one decimal place (half up), with
 * a trailing ".0" dropped ("1 lakh"). Nothing below one lakh gets a word, so 50,000 stays
 * "Rs 50,000" alone (null). An amount that rounds up to 100 lakh is promoted to "1 crore"
 * instead of "100 lakh".
 */
export function formatRupeeWords(inr: number, language: Language): string | null {
  if (!isFormattable(inr)) return null;
  const magnitude = Math.abs(inr);
  if (magnitude < LAKH) return null;
  const sign = inr < 0 ? '-' : '';
  const lakhTenths = tenthsOf(magnitude, LAKH);
  if (lakhTenths < TENTHS_OF_A_CRORE_IN_LAKH_TENTHS) {
    return `${sign}${withDecimal(lakhTenths)} ${LAKH_WORD[language]}`;
  }
  return `${sign}${withDecimal(tenthsOf(magnitude, CRORE))} ${CRORE_WORD[language]}`;
}
