// The check page (spec 6.3, FR-2 to FR-4): what was read, beside the user's own words, and the
// questions still open. Functions take only strings and numbers, so the parity test can call
// every one with sample arguments.

import type { BriefField, QuestionReason } from '@/core/brief/questions';
import type { FieldVerdict } from '@/schemas/plan/state-token';

type Status = FieldVerdict['status'];

export interface CheckDictionary {
  readonly title: string;
  readonly source: {
    readonly ai: string;
    readonly aiCached: string;
    readonly example: (recordedOn: string) => string;
    readonly form: string;
  };
  readonly matched: (matched: number, total: number) => string;
  readonly summaryQuestions: (count: number) => string;
  readonly summaryReady: string;
  readonly readHeading: string;
  readonly status: Readonly<Record<Status, string>>;
  readonly answersHeading: string;
  readonly questionMark: string;
  readonly question: Readonly<Record<QuestionReason, (given: string, upper: string) => string>>;
  readonly notOne: Readonly<Record<BriefField, (quote: string) => string>>;
  readonly notFound: (quote: string) => string;
  readonly gave: (given: string) => string;
  readonly fields: Readonly<Record<BriefField, string>>;
  readonly noteLabel: string;
  readonly choicesHeading: string;
  /** The heading when the wedding function rows are not shown. */
  readonly choicesHeadingNoFunctions: string;
  readonly notedHeading: string;
  readonly notedHint: string;
  readonly confirm: string;
  readonly cancel: string;
  readonly cancelHint: string;
  readonly otherKind: string;
}

export const en: CheckDictionary = {
  title: 'Check what we read',
  source: {
    ai: 'Read by AI',
    aiCached:
      'Read by AI (cached). This exact text was read recently, so we reused that reading instead of spending the AI quota again.',
    example: (recordedOn) =>
      `Example reading, recorded on ${recordedOn}; your own words are read live.`,
    form: 'Entered by form',
  },
  matched: (matched, total) => `${String(matched)} of ${String(total)} values matched your words.`,
  summaryQuestions: (count) =>
    count === 1
      ? '1 question needs your answer before the plan is made.'
      : `${String(count)} questions need your answer before the plan is made.`,
  summaryReady: 'Everything needed is here. Check the values, then make the plan.',
  readHeading: 'What we read',
  status: {
    verified: 'Matched your words',
    unverified: 'Not found in your words',
    unclear: 'Not clear',
    absent: 'Not mentioned',
  },
  answersHeading: 'Your answers',
  questionMark: 'Question',
  question: {
    missing: () => 'Please fill this in. We do not guess it.',
    unreadable: (given) => `We could not read "${given}". Please write it again.`,
    'several-numbers': (given) => `"${given}" holds more than one number. Please give one.`,
    'not-whole': (given) => `"${given}" is not a whole number. Please give a whole number.`,
    'out-of-range': (min, max) => `Please give a value from ${min} to ${max}.`,
    'date-passed': () => 'This date has passed; pick a date after today.',
    'date-invalid': () => 'This is not a real date. Please pick one from the calendar.',
    'no-profile': () => 'We cannot plan this occasion yet. Please pick another one.',
  },
  notOne: {
    occasion: (quote) => `We read "${quote}", which is not one occasion we know.`,
    budget: (quote) => `We read "${quote}", which is not one amount.`,
    guests: (quote) => `We read "${quote}", which is not one guest count.`,
    eventDate: (quote) => `We read "${quote}", which is not one date.`,
    venueCapacity: (quote) => `We read "${quote}", which is not one number.`,
  },
  notFound: (quote) => `We could not find "${quote}" in your words, so please check this value.`,
  gave: (given) => `You gave ${given}.`,
  fields: {
    occasion: 'Occasion',
    budget: 'Budget',
    guests: 'Guests',
    eventDate: 'Date',
    venueCapacity: 'Venue capacity',
  },
  noteLabel: 'Noted',
  choicesHeading: 'Functions, priorities and needs',
  choicesHeadingNoFunctions: 'Priorities and needs',
  notedHeading: 'Noted, not planned by this app',
  notedHint: 'These stay in your plan as notes. No number or task is computed from them.',
  confirm: 'Make the plan',
  cancel: 'Cancel',
  cancelHint: 'Cancel drops this reading. Nothing is kept.',
  otherKind: 'This reading is checked on its own page. You can cancel it here.',
};

export const hi: CheckDictionary = {
  title: 'जो पढ़ा, उसे जाँचिए',
  source: {
    ai: 'AI ने पढ़ा',
    aiCached:
      'AI ने पढ़ा (पहले से रखा हुआ)। यही टेक्स्ट हाल में पढ़ा गया था, इसलिए AI का कोटा ख़र्च करने के बजाय वही पढ़ा हुआ नतीजा फिर से इस्तेमाल किया गया।',
    example: (recordedOn) =>
      `उदाहरण का पढ़ा हुआ नतीजा, ${recordedOn} को रिकॉर्ड किया गया; आपके अपने शब्द अभी पढ़े जाते हैं।`,
    form: 'फ़ॉर्म से भरा',
  },
  matched: (matched, total) =>
    `${String(total)} में से ${String(matched)} मान आपके शब्दों से मिले।`,
  summaryQuestions: (count) =>
    count === 1
      ? 'योजना बनाने से पहले 1 सवाल का जवाब चाहिए।'
      : `योजना बनाने से पहले ${String(count)} सवालों के जवाब चाहिए।`,
  summaryReady: 'ज़रूरी सब कुछ यहाँ है। मान जाँचिए, फिर योजना बनाइए।',
  readHeading: 'हमने क्या पढ़ा',
  status: {
    verified: 'आपके शब्दों से मिला',
    unverified: 'आपके शब्दों में नहीं मिला',
    unclear: 'साफ़ नहीं',
    absent: 'ज़िक्र नहीं',
  },
  answersHeading: 'आपके जवाब',
  questionMark: 'सवाल',
  question: {
    missing: () => 'कृपया यह भरिए। हम इसका अंदाज़ा नहीं लगाते।',
    unreadable: (given) => `हम "${given}" नहीं पढ़ पाए। कृपया फिर से लिखिए।`,
    'several-numbers': (given) => `"${given}" में एक से ज़्यादा संख्या है। कृपया एक ही दीजिए।`,
    'not-whole': (given) => `"${given}" पूरी संख्या नहीं है। कृपया पूरी संख्या दीजिए।`,
    'out-of-range': (min, max) => `कृपया ${min} से ${max} के बीच का मान दीजिए।`,
    'date-passed': () => 'यह तारीख़ निकल चुकी है; आज के बाद की तारीख़ चुनिए।',
    'date-invalid': () => 'यह असली तारीख़ नहीं है। कृपया कैलेंडर से चुनिए।',
    'no-profile': () => 'इस मौके की योजना हम अभी नहीं बना सकते। कृपया कोई और चुनिए।',
  },
  notOne: {
    occasion: (quote) => `हमने "${quote}" पढ़ा, जो हमारे जाने-पहचाने मौकों में से कोई नहीं है।`,
    budget: (quote) => `हमने "${quote}" पढ़ा, जो कोई एक रक़म नहीं है।`,
    guests: (quote) => `हमने "${quote}" पढ़ा, जो मेहमानों की कोई एक गिनती नहीं है।`,
    eventDate: (quote) => `हमने "${quote}" पढ़ा, जो कोई एक तारीख़ नहीं है।`,
    venueCapacity: (quote) => `हमने "${quote}" पढ़ा, जो कोई एक संख्या नहीं है।`,
  },
  notFound: (quote) => `"${quote}" आपके शब्दों में नहीं मिला, इसलिए कृपया यह मान जाँच लीजिए।`,
  gave: (given) => `आपने ${given} दिया।`,
  fields: {
    occasion: 'मौका',
    budget: 'बजट',
    guests: 'मेहमान',
    eventDate: 'तारीख़',
    venueCapacity: 'वेन्यू में कितने लोग',
  },
  noteLabel: 'लिख लिया',
  choicesHeading: 'फ़ंक्शन, प्राथमिकताएँ और ज़रूरतें',
  choicesHeadingNoFunctions: 'प्राथमिकताएँ और ज़रूरतें',
  notedHeading: 'लिख लिया, पर यह ऐप इसकी योजना नहीं बनाता',
  notedHint: 'ये आपकी योजना में नोट की तरह रहते हैं। इनसे कोई रक़म या काम नहीं निकाला जाता।',
  confirm: 'योजना बनाइए',
  cancel: 'रद्द करें',
  cancelHint: 'रद्द करने पर यह पढ़ा हुआ नतीजा हट जाता है। कुछ नहीं रखा जाता।',
  otherKind: 'यह पढ़ा हुआ नतीजा अपने पेज पर जाँचा जाता है। आप इसे यहाँ रद्द कर सकते हैं।',
};
