// The plan page (spec 6.4): the headline, the money table, the timeline, a short ledger and the
// links onward. Functions take only strings and numbers, so the parity test can call each one.

import { slackEn, slackHi } from '../slack-words';

export interface PlanDictionary {
  readonly title: (version: number, occasion: string, date: string) => string;
  readonly readByAi: (matched: number, total: number) => string;
  readonly readByExample: (matched: number, total: number) => string;
  readonly enteredByForm: string;
  readonly statusSummary: (version: number, step: string) => string;
  readonly keepLink: string;
  readonly jumpTo: string;
  readonly headlineHeading: string;
  readonly budget: string;
  readonly guests: string;
  readonly date: string;
  readonly venue: string;
  readonly venueUnknown: string;
  readonly venueFromBooking: string;
  readonly projected: string;
  readonly overBy: string;
  readonly leftOver: string;
  readonly status: string;
  readonly withinBudget: string;
  readonly overBudget: string;
  readonly notPriced: string;
  readonly notPricedReason: string;
  readonly moneyHeading: string;
  readonly moneyCaption: string;
  readonly moneyCaptionNote: string;
  readonly categoryColumn: string;
  readonly splitColumn: string;
  readonly projectedColumn: string;
  readonly total: string;
  readonly whyHeading: string;
  readonly tasksHeading: string;
  readonly finishBy: (date: string) => string;
  /** Negative is days late, positive days to spare. */
  readonly slack: (days: number) => string;
  readonly critical: string;
  readonly doneOn: (date: string) => string;
  readonly ledgerHeading: string;
  readonly notedHeading: string;
  readonly nextHeading: string;
  readonly quotesLink: string;
  readonly changeLink: string;
  readonly leversLink: string;
  readonly messagesLink: string;
}

export const en: PlanDictionary = {
  title: (version, occasion, date) => `Plan v${String(version)}: ${occasion}, ${date}`,
  readByAi: (matched, total) =>
    `Read by AI: ${String(matched)} of ${String(total)} values matched your words.`,
  readByExample: (matched, total) =>
    `Example reading: ${String(matched)} of ${String(total)} values matched the example words.`,
  enteredByForm: 'Entered by form.',
  statusSummary: (version, step) => `Plan v${String(version)} is ready. Latest step: ${step}.`,
  keepLink: "This page's link is your plan. Bookmark it, or share it with family.",
  jumpTo: 'Jump to',
  headlineHeading: 'At a glance',
  budget: 'Budget',
  guests: 'Guests',
  date: 'Date',
  venue: 'Venue capacity',
  venueUnknown: 'Not given yet',
  venueFromBooking: 'from the venue booking',
  projected: 'Projected cost',
  overBy: 'Over budget by',
  leftOver: 'Left in the budget',
  status: 'Status',
  withinBudget: 'Within budget',
  overBudget: 'Over budget',
  notPriced: 'Not priced yet',
  notPricedReason: 'add a quote or a booking to compare',
  moneyHeading: 'Money',
  moneyCaption: 'Where the money goes',
  moneyCaptionNote:
    'Your split of your own budget, not prices. Real prices come from vendor quotes.',
  categoryColumn: 'Category',
  splitColumn: 'Your split',
  projectedColumn: 'Projected',
  total: 'Total',
  whyHeading: 'Why these numbers?',
  tasksHeading: 'Tasks (critical path first)',
  finishBy: (date) => `Finish by ${date}`,
  slack: slackEn,
  critical: 'On the critical path',
  doneOn: (date) => `Done on ${date}`,
  ledgerHeading: 'Ledger',
  notedHeading: 'Noted, not planned by this app',
  nextHeading: 'Next steps',
  quotesLink: 'Add a vendor quote',
  changeLink: 'See what changed',
  leversLink: 'Choose trade-offs',
  messagesLink: 'Messages for vendors and family',
};

export const hi: PlanDictionary = {
  title: (version, occasion, date) => `योजना v${String(version)}: ${occasion}, ${date}`,
  readByAi: (matched, total) =>
    `AI ने पढ़ा: ${String(total)} में से ${String(matched)} मान आपके शब्दों से मिले।`,
  readByExample: (matched, total) =>
    `उदाहरण का पढ़ा हुआ नतीजा: ${String(total)} में से ${String(matched)} मान उदाहरण के शब्दों से मिले।`,
  enteredByForm: 'फ़ॉर्म से भरा।',
  statusSummary: (version, step) => `योजना v${String(version)} तैयार है। आख़िरी क़दम: ${step}।`,
  keepLink: 'इस पेज का लिंक ही आपकी योजना है। इसे बुकमार्क करें या परिवार से साझा करें।',
  jumpTo: 'सीधे जाएँ',
  headlineHeading: 'एक नज़र में',
  budget: 'बजट',
  guests: 'मेहमान',
  date: 'तारीख़',
  venue: 'वेन्यू में कितने लोग',
  venueUnknown: 'अभी नहीं बताया',
  venueFromBooking: 'वेन्यू की बुकिंग से',
  projected: 'अनुमानित ख़र्च',
  overBy: 'बजट से ज़्यादा',
  leftOver: 'बजट में बचा',
  status: 'स्थिति',
  withinBudget: 'बजट के अंदर',
  overBudget: 'बजट से ज़्यादा',
  notPriced: 'अभी दाम नहीं लगे',
  notPricedReason: 'तुलना के लिए कोटेशन या बुकिंग जोड़ें',
  moneyHeading: 'पैसा',
  moneyCaption: 'पैसा कहाँ जाता है',
  moneyCaptionNote:
    'यह आपके अपने बजट का बँटवारा है, दाम नहीं। असली दाम विक्रेताओं के कोटेशन से आते हैं।',
  categoryColumn: 'मद',
  splitColumn: 'आपका बँटवारा',
  projectedColumn: 'अनुमानित',
  total: 'कुल',
  whyHeading: 'ये आँकड़े क्यों?',
  tasksHeading: 'काम (सबसे ज़रूरी पहले)',
  finishBy: (date) => `${date} तक पूरा करें`,
  slack: slackHi,
  critical: 'सबसे ज़रूरी कड़ी में',
  doneOn: (date) => `${date} को हो गया`,
  ledgerHeading: 'बही',
  notedHeading: 'लिख लिया, पर यह ऐप इसकी योजना नहीं बनाता',
  nextHeading: 'आगे क्या',
  quotesLink: 'विक्रेता का कोटेशन जोड़ें',
  changeLink: 'क्या बदला, देखें',
  leversLink: 'समझौते चुनें',
  messagesLink: 'विक्रेताओं और परिवार के लिए संदेश',
};
