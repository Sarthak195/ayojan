// The quotes page and the quote check page (spec 6.5, C4, C5): the paste box, the form twin,
// the comparison's cell words and the questions to ask. The row headings, vendor names, the
// break-even sentence and "Unconfirmed until you book" live beside the numbers in
// core/quotes/quote-wording.ts, so this area holds only the words around them.

import type { QuoteGap, TaxKind } from '@/core/quotes/quote-types';
import type { QuoteBasis, TaxTreatment } from '@/schemas/readings/vocabulary';

import { hi } from './quotes-hi';

export { hi };

export interface QuotesDictionary {
  readonly title: string;
  readonly intro: string;
  readonly summary: (version: number, step: string) => string;
  readonly pendingNote: string;
  readonly pendingLink: string;
  readonly full: string;
  readonly pasteHeading: string;
  readonly pasteLabel: string;
  readonly pasteHint: string;
  readonly readButton: string;
  readonly formFallback: string;
  readonly samplesHeading: string;
  readonly samplePerPlate: string;
  readonly samplePackage: string;
  readonly sampleNote: string;
  readonly formSummary: string;
  readonly formIntro: string;
  readonly categoryLegend: string;
  readonly basisLegend: string;
  readonly basis: Readonly<Record<QuoteBasis, string>>;
  readonly rateLabel: string;
  readonly rateHint: string;
  readonly minimumLabel: string;
  readonly coveredLabel: string;
  readonly numberHint: string;
  readonly taxLegend: string;
  readonly tax: Readonly<Record<TaxTreatment, string>>;
  readonly taxRateLabel: string;
  readonly taxRateHint: string;
  readonly liveCounterLabel: string;
  readonly inclusionLabel: (index: number) => string;
  readonly advanceLabel: string;
  readonly addButton: string;
  readonly emptyComparison: string;
  readonly comparisonHeading: (category: string, guests: string) => string;
  readonly splitNote: string;
  readonly vendorColumn: string;
  readonly nothingListed: string;
  readonly perPlateMinimum: (plates: string) => string;
  readonly perPlateNoMinimum: string;
  readonly upTo: (guests: string) => string;
  readonly notStated: string;
  readonly notClear: string;
  readonly taxCell: Readonly<Record<Exclude<TaxKind, 'added'>, string>>;
  readonly taxAdded: (percent: string) => string;
  readonly liveCounter: string;
  readonly counted: string;
  readonly notCounted: string;
  readonly advance: (percent: string) => string;
  readonly gaps: Readonly<Record<QuoteGap, string>>;
  readonly capExceeded: string;
  readonly nothingToClarify: string;
  readonly plusGst: string;
  readonly includesTax: string;
  readonly notComparable: string;
  readonly aboveSplit: string;
  readonly belowSplit: string;
  readonly atSplit: string;
  readonly questionsHeading: string;
  readonly askVendor: (vendor: string) => string;
  readonly nothingToAsk: string;
  readonly needsReconfirmation: string;
  readonly checkReady: string;
  readonly checkQuestions: (count: number) => string;
  readonly addAs: (vendor: string) => string;
  readonly addAsSlot: (slot: string) => string;
  readonly categoryQuestion: string;
  readonly unverifiedQuestion: string;
  readonly unclearQuestion: string;
  readonly advanceOutOfRange: string;
  readonly otherCharges: string;
  readonly readWords: string;
  readonly backToPlan: string;
}

export const en: QuotesDictionary = {
  title: 'Vendor quotes',
  intro:
    'Paste a vendor message as it came, or enter the quote by form. Quotes are compared at your current guest count; nothing here books a vendor.',
  summary: (version, step) => `Plan v${String(version)}. Latest step: ${step}.`,
  pendingNote: 'A quote you read is waiting to be checked.',
  pendingLink: 'Check that quote',
  full: 'This plan holds six quotes, the most it can keep. Undo a step to add another.',
  pasteHeading: 'Paste a quote',
  pasteLabel: "Paste the vendor's message",
  pasteHint: 'Up to 2,000 characters. We keep only the figures, never the message.',
  readButton: 'Read this quote',
  formFallback: 'If the AI reader is busy, use the form instead',
  samplesHeading: 'Try with sample quotes',
  samplePerPlate: 'Sample: a caterer charging per plate',
  samplePackage: 'Sample: a caterer with one package price',
  sampleNote: 'This is a sample vendor message. Edit it, or read it as it is.',
  formSummary: 'Enter the quote by form',
  formIntro: 'No AI is involved. Leave a number empty if the vendor did not give it.',
  categoryLegend: 'What is this quote for?',
  basisLegend: 'How is it priced?',
  basis: {
    perPlate: 'Per plate',
    lumpSum: 'One amount for a package',
    perDay: 'Per day',
    unclear: 'Not clear',
  },
  rateLabel: 'Rate or package amount in rupees',
  rateHint: 'The price per plate, or the package amount. Whole rupees, for example 1300.',
  minimumLabel: 'Minimum plates',
  coveredLabel: 'Guests the package covers',
  numberHint: 'A whole number, for example 200.',
  taxLegend: 'Tax (GST)',
  tax: {
    included: 'Included',
    extraWithRate: 'Extra, at a stated rate',
    extraRateUnstated: 'Extra, rate not stated',
    unclear: 'Not clear',
    absent: 'Not mentioned',
  },
  taxRateLabel: 'GST rate in percent',
  taxRateHint: 'Only if the vendor stated it, for example 18. We never assume a rate.',
  liveCounterLabel: 'Live counter charge in rupees',
  inclusionLabel: (index) => `Included item ${String(index)}`,
  advanceLabel: 'Advance in percent',
  addButton: 'Add this quote',
  emptyComparison: 'No quotes yet. Paste a message or use the form to add the first one.',
  comparisonHeading: (category, guests) => `${category} at ${guests} guests`,
  splitNote: 'Your split for this category:',
  vendorColumn: 'Quote',
  nothingListed: 'Nothing listed',
  perPlateMinimum: (plates) => `Per plate, minimum ${plates} plates`,
  perPlateNoMinimum: 'Per plate, no minimum stated',
  upTo: (guests) => `Up to ${guests} guests`,
  notStated: 'Not stated',
  notClear: 'Not clear',
  taxCell: {
    included: 'GST included',
    'rate-not-stated': 'GST extra, rate not stated',
    unclear: 'Tax not clear',
  },
  taxAdded: (percent) => `GST ${percent} percent, added`,
  liveCounter: 'Live counter',
  counted: 'added to the total (a must-have)',
  notCounted: 'not added (not a must-have)',
  advance: (percent) => `Advance ${percent} percent`,
  gaps: {
    basis: 'How the price is worked out',
    rate: 'The rate',
    days: 'For how many days?',
    minimumGuests: 'The minimum number of plates',
    rateAboveMinimum: 'The rate above the minimum',
    guestsCovered: 'How many guests are covered',
    taxRate: 'The GST rate',
    liveCounter: 'The live counter charge',
  },
  capExceeded: 'Guest cap exceeded: re-quote needed',
  nothingToClarify: 'Nothing',
  plusGst: 'plus GST, rate not stated',
  includesTax: 'includes GST of',
  notComparable: 'No comparable total yet; see what still needs clarification',
  aboveSplit: 'above your split',
  belowSplit: 'below your split',
  atSplit: 'equal to your split',
  questionsHeading: 'Questions to ask',
  askVendor: (vendor) => `Questions to ask ${vendor}`,
  nothingToAsk: 'Nothing to ask this vendor yet.',
  needsReconfirmation: 'Needs re-confirmation',
  checkReady: 'Check the values, then add the quote.',
  checkQuestions: (count) =>
    count === 1
      ? '1 value needs a look before the quote is added.'
      : `${String(count)} values need a look before the quote is added.`,
  addAs: (vendor) => `Add as ${vendor}`,
  addAsSlot: (slot) => `Add as quote ${slot}`,
  categoryQuestion: 'Please pick what this quote is for. We do not guess it.',
  unverifiedQuestion: 'We could not find these words in the message. Please check this value.',
  unclearQuestion:
    'This was not clear. Fill it in if you know it, or leave it empty and we will list it as a question for the vendor.',
  advanceOutOfRange: 'An advance is from 0 to 100 percent. Please check it.',
  otherCharges: 'Other charges read from the message',
  readWords: 'From the message:',
  backToPlan: 'Back to the plan',
};
