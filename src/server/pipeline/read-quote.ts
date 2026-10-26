import 'server-only';

import { QuoteReading } from '@/schemas/readings/quote-reading';
import type { TaxTreatment } from '@/schemas/readings/vocabulary';
import * as quote from '@/server/prompts/quote';

import type { ReadingOutcome } from './reading-outcome';
import { runReader, type PendingValues, type ReaderDeps } from './run-reader';
import {
  isVerified,
  keptNumber,
  presenceOf,
  presenceWith,
  spelled,
  whole,
  type Verdicts,
} from './verdicts';

const AMOUNT = whole(0, 100_000_000);
const RATE = whole(1, 100_000_000);
const GUEST_COUNT = whole(1, 10_000);
const PERCENT = whole(0, 100);
// GST rates such as 12.5 are not whole numbers; they become basis points below.
const TAX_PERCENT = { min: 0, max: 100, integer: false };
const LABEL_MAX = 40;

// The extra's key only picks which vendor question to ask about it ("is the live counter
// needed?"); it never changes a total, so a plain word match on the label is enough.
const LIVE_COUNTER = /live|counter|लाइव|काउंटर/i;

type Amount = QuoteReading['extras'][number];
type Extra = Extract<PendingValues, { kind: 'quote' }>['values']['extras'][number];

function readTax(
  tax: QuoteReading['tax'],
  verdicts: Verdicts,
): { tax: TaxTreatment; taxBasisPoints: number | null } {
  const presence = tax.value === 'absent' ? 'absent' : presenceOf(tax.value);
  const numbers =
    tax.value === 'extraWithRate' && tax.ratePercent !== null
      ? [{ value: tax.ratePercent, bounds: TAX_PERCENT, inQuote: true }]
      : [];
  const verdict = verdicts.check('tax', { presence, quote: tax.quote, numbers });
  if (tax.value === 'absent') return { tax: 'absent', taxBasisPoints: null };
  if (!isVerified(verdict)) return { tax: 'unclear', taxBasisPoints: null };
  // 18 percent is stored as 1800 so tax arithmetic stays in integers.
  const basisPoints = numbers.length > 0 && tax.ratePercent !== null ? tax.ratePercent * 100 : null;
  return {
    tax: tax.value,
    taxBasisPoints: basisPoints === null ? null : Math.round(basisPoints),
  };
}

function checkAmount(field: string, amount: Amount, verdicts: Verdicts): boolean {
  const verdict = verdicts.check(field, {
    presence: 'present',
    quote: amount.quote,
    numbers: spelled(amount.amountInr, AMOUNT),
  });
  return isVerified(verdict);
}

function readExtras(extras: readonly Amount[], verdicts: Verdicts): Extra[] {
  const kept: Extra[] = [];
  extras.forEach((extra, index) => {
    if (!checkAmount(`extra.${String(index)}`, extra, verdicts)) return;
    kept.push({
      key: LIVE_COUNTER.test(extra.label) ? 'liveCounter' : 'other',
      label: extra.label.slice(0, LABEL_MAX),
      amountInr: extra.amountInr,
    });
  });
  return kept;
}

function readInclusions(inclusions: readonly Amount[], verdicts: Verdicts): string[] {
  return inclusions
    .filter((inclusion, index) => checkAmount(`inclusion.${String(index)}`, inclusion, verdicts))
    .map((inclusion) => inclusion.label.slice(0, LABEL_MAX));
}

function buildQuote(reading: QuoteReading, verdicts: Verdicts): PendingValues {
  const { category, basis, rateInr, minimumGuests, guestsCovered, advancePercent } = reading;
  const categoryVerdict = verdicts.check('category', {
    presence: presenceOf(category.value),
    quote: category.quote,
  });
  const basisVerdict = verdicts.check('basis', {
    presence: presenceOf(basis.value),
    quote: basis.quote,
  });
  const rateVerdict = verdicts.check('rateInr', {
    // A rate the quote talks about without a number ("rate baad mein") is asked, not matched.
    presence:
      rateInr.amountInr === null && rateInr.quote === ''
        ? 'absent'
        : presenceWith('present', rateInr.amountInr),
    quote: rateInr.quote,
    numbers: spelled(rateInr.amountInr, RATE),
  });
  const minimumVerdict = verdicts.check('minimumGuests', {
    presence: presenceWith(minimumGuests.presence, minimumGuests.count),
    quote: minimumGuests.quote,
    numbers: spelled(minimumGuests.count, GUEST_COUNT),
  });
  const coveredVerdict = verdicts.check('guestsCovered', {
    presence: presenceWith(guestsCovered.presence, guestsCovered.count),
    quote: guestsCovered.quote,
    numbers: spelled(guestsCovered.count, GUEST_COUNT),
  });
  const advanceVerdict = verdicts.check('advancePercent', {
    presence: presenceWith(advancePercent.presence, advancePercent.percent),
    quote: advancePercent.quote,
    numbers: spelled(advancePercent.percent, PERCENT),
  });
  return {
    kind: 'quote',
    values: {
      category: isVerified(categoryVerdict) && category.value !== 'unclear' ? category.value : null,
      basis: isVerified(basisVerdict) ? basis.value : 'unclear',
      rateInr: keptNumber(rateVerdict, rateInr.amountInr),
      minimumGuests: keptNumber(minimumVerdict, minimumGuests.count),
      guestsCovered: keptNumber(coveredVerdict, guestsCovered.count),
      ...readTax(reading.tax, verdicts),
      extras: readExtras(reading.extras, verdicts),
      inclusions: readInclusions(reading.inclusions, verdicts),
      // Unlike a count, a percent above 100 cannot be stored even as a question.
      advancePercent: isVerified(advanceVerdict) ? advancePercent.percent : null,
    },
  };
}

/** Call 2 (G2): reads a pasted vendor quote into a pending reading, or the form twin. */
export function readQuote(
  deps: ReaderDeps,
  input: { readonly text: string },
): Promise<ReadingOutcome> {
  return runReader(deps, {
    kind: 'quote',
    prompt: quote,
    schema: QuoteReading,
    text: input.text,
    build: buildQuote,
  });
}
