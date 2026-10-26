// The revision page (spec 6.6, FR-25 to FR-29, D29, D32): the diff of the latest change, the
// Kept lists with their counter, the vendors to ask again, and Undo. Functions take only
// strings and numbers, so the parity test can call every one with sample arguments.

type Reconfirm = 'date' | 'guests' | 'capacity' | 'cap-exceeded';

export interface RevisionDictionary {
  readonly title: (version: number) => string;
  readonly noChangeTitle: string;
  readonly noChangeBody: string;
  readonly statusOver: (version: number, amount: string) => string;
  readonly statusWithin: (version: number, amount: string) => string;
  readonly statusNoChange: (version: number) => string;
  readonly laterSteps: (after: number, current: number) => string;
  readonly counter: (kept: number, total: number) => string;
  readonly diffHeading: string;
  readonly diffCaption: (before: number, after: number) => string;
  readonly diffNote: string;
  readonly whatColumn: string;
  readonly beforeColumn: string;
  readonly nowColumn: string;
  readonly whyColumn: string;
  readonly guests: string;
  readonly budget: string;
  readonly date: string;
  readonly projected: string;
  readonly gap: string;
  readonly over: string;
  readonly under: string;
  readonly venueFit: string;
  readonly fits: (guests: number, capacity: number) => string;
  readonly overCapacity: (guests: number, capacity: number) => string;
  readonly cheapestIn: (category: string) => string;
  readonly cheaper: (vendor: string) => string;
  readonly noQuote: string;
  readonly movedTo: (category: string) => string;
  /** Each follows an amount with its own provenance label, so they hold no number. */
  readonly fromHeadroom: string;
  readonly fromGiver: (category: string) => string;
  readonly shortfall: string;
  readonly reason: {
    readonly guestsChanged: (percent: number) => string;
    readonly budgetChanged: string;
    readonly eventDateMoved: string;
    readonly reallocated: string;
    readonly rankingFlipped: (guests: string) => string;
    readonly taskDelayed: (task: string) => string;
    readonly leverApplied: (lever: string) => string;
    readonly taskDone: (task: string) => string;
    readonly quoteAdded: (vendor: string) => string;
  };
  readonly keptHeading: string;
  readonly keptIntro: string;
  readonly askAgainHeading: string;
  readonly askAgainIntro: string;
  readonly changedHeading: string;
  readonly none: string;
  readonly decision: {
    readonly priority: (category: string, level: string) => string;
    readonly mustHave: (item: string) => string;
    readonly need: (item: string) => string;
    readonly diet: (item: string) => string;
    readonly venueLimit: (item: string) => string;
    readonly function: (name: string, answer: string) => string;
    readonly booking: (category: string) => string;
    readonly quote: (vendor: string) => string;
    readonly taskDone: (task: string) => string;
    readonly taskDelayed: (task: string, date: string) => string;
    readonly lever: (lever: string) => string;
  };
  readonly reconfirmHeading: string;
  readonly reconfirmIntro: string;
  readonly reconfirmNone: string;
  readonly needsReconfirmation: string;
  readonly reconfirmReason: Readonly<Record<Reconfirm, string>>;
  readonly undo: string;
  readonly undoHint: string;
  readonly backToPlan: string;
}

export const en: RevisionDictionary = {
  title: (version) => `What changed in v${String(version)}`,
  noChangeTitle: 'No change yet',
  noChangeBody:
    'This plan has no confirmed change yet. Tell us what changed under "What changed?" on the plan.',
  statusOver: (version, amount) =>
    `Change applied: plan v${String(version)}, over budget by ${amount}.`,
  statusWithin: (version, amount) =>
    `Change applied: plan v${String(version)}, ${amount} left in the budget.`,
  statusNoChange: (version) => `Plan v${String(version)} has no confirmed change yet.`,
  laterSteps: (after, current) =>
    `This compares the latest change (v${String(after)}); the plan is now at v${String(current)}.`,
  counter: (kept, total) =>
    `Revised, not restarted: ${String(kept)} of ${String(total)} decisions kept.`,
  diffHeading: 'What changed',
  diffCaption: (before, after) => `Plan v${String(before)} against v${String(after)}`,
  diffNote: 'Only rows that changed are listed. Figures come from your plan, not market prices.',
  whatColumn: 'What',
  beforeColumn: 'Before',
  nowColumn: 'Now',
  whyColumn: 'Why',
  guests: 'Guests',
  budget: 'Budget',
  date: 'Date',
  projected: 'Projected spend',
  gap: 'Against the budget',
  over: 'Over by',
  under: 'Left',
  venueFit: 'Venue fits',
  fits: (guests, capacity) => `Yes: ${String(guests)} within ${String(capacity)}`,
  overCapacity: (guests, capacity) => `No: ${String(guests)} > ${String(capacity)}`,
  cheapestIn: (category) => `Cheapest quote, ${category}`,
  cheaper: (vendor) => `${vendor} cheaper`,
  noQuote: 'No quote',
  movedTo: (category) => `Money moved to ${category}`,
  fromHeadroom: 'from money not yet planned',
  fromGiver: (category) => `from ${category}`,
  shortfall: 'could not be found, so it shows as over budget',
  reason: {
    guestsChanged: (percent) =>
      percent > 0
        ? `Guests changed; this line grows with guests at ${String(percent)} percent`
        : 'Guests changed',
    budgetChanged: 'Budget changed',
    eventDateMoved: 'Date moved',
    reallocated: 'Money moved',
    rankingFlipped: (guests) =>
      guests === '' ? 'Cheapest quote changed' : `Cheapest quote changed at ${guests} guests`,
    taskDelayed: (task) => `Delayed: ${task}`,
    leverApplied: (lever) => `Trade-off chosen: ${lever}`,
    taskDone: (task) => `Done: ${task}`,
    quoteAdded: (vendor) => `Quote added: ${vendor}`,
  },
  keptHeading: 'Kept',
  keptIntro: 'Decisions that carry over unchanged.',
  askAgainHeading: 'Kept, ask again',
  askAgainIntro: 'Kept, but the vendor agreed to the old guests or date, so confirm with them.',
  changedHeading: 'Changed by this step',
  none: 'None.',
  decision: {
    priority: (category, level) => `${category}: ${level}`,
    mustHave: (item) => `Must-have: ${item}`,
    need: (item) => `Guests who need care: ${item}`,
    diet: (item) => `Food: ${item}`,
    venueLimit: (item) => `Venue: ${item}`,
    function: (name, answer) => `${name}: ${answer}`,
    booking: (category) => `${category} booked`,
    quote: (vendor) => `Quote from ${vendor}`,
    taskDone: (task) => `Done: ${task}`,
    taskDelayed: (task, date) => `${task}: not before ${date}`,
    lever: (lever) => `Trade-off: ${lever}`,
  },
  reconfirmHeading: 'Ask these vendors again',
  reconfirmIntro:
    'Each one agreed to terms the plan has moved away from. Send them these questions.',
  reconfirmNone: 'No vendor needs to confirm again.',
  needsReconfirmation: 'Needs re-confirmation',
  reconfirmReason: {
    date: 'The date moved',
    guests: 'The guest count changed',
    capacity: 'Guests are above the booked capacity',
    'cap-exceeded': "Guests are above the quote's limit: re-quote needed",
  },
  undo: 'Undo last step',
  undoHint: 'Removes the latest step, whatever it was. The plan returns to the version before it.',
  backToPlan: 'Back to the plan',
};

export const hi: RevisionDictionary = {
  title: (version) => `v${String(version)} में क्या बदला`,
  noChangeTitle: 'अभी कोई बदलाव नहीं',
  noChangeBody:
    'इस योजना में अभी कोई पक्का बदलाव नहीं है। योजना पर "क्या बदला?" में बताइए क्या बदला।',
  statusOver: (version, amount) =>
    `बदलाव लागू: योजना v${String(version)}, बजट से ${amount} ज़्यादा।`,
  statusWithin: (version, amount) =>
    `बदलाव लागू: योजना v${String(version)}, बजट में ${amount} बचे।`,
  statusNoChange: (version) => `योजना v${String(version)} में अभी कोई पक्का बदलाव नहीं है।`,
  laterSteps: (after, current) =>
    `यह सबसे हाल के बदलाव (v${String(after)}) की तुलना है; योजना अब v${String(current)} पर है।`,
  counter: (kept, total) =>
    `संशोधित, नए सिरे से नहीं: ${String(total)} में से ${String(kept)} फ़ैसले बरक़रार।`,
  diffHeading: 'क्या बदला',
  diffCaption: (before, after) => `योजना v${String(before)} बनाम v${String(after)}`,
  diffNote: 'सिर्फ़ बदली हुई पंक्तियाँ दिखाई गई हैं। आँकड़े आपकी योजना से हैं, बाज़ार भाव नहीं।',
  whatColumn: 'क्या',
  beforeColumn: 'पहले',
  nowColumn: 'अब',
  whyColumn: 'क्यों',
  guests: 'मेहमान',
  budget: 'बजट',
  date: 'तारीख़',
  projected: 'अनुमानित ख़र्च',
  gap: 'बजट के मुक़ाबले',
  over: 'ज़्यादा',
  under: 'बचे',
  venueFit: 'वेन्यू में जगह',
  fits: (guests, capacity) => `हाँ: ${String(capacity)} में ${String(guests)}`,
  overCapacity: (guests, capacity) => `नहीं: ${String(guests)} > ${String(capacity)}`,
  cheapestIn: (category) => `सबसे सस्ता कोटेशन, ${category}`,
  cheaper: (vendor) => `${vendor} सस्ता`,
  noQuote: 'कोई कोटेशन नहीं',
  movedTo: (category) => `${category} में पैसा डाला`,
  fromHeadroom: 'उस पैसे से जो अभी तय नहीं था',
  fromGiver: (category) => `${category} से`,
  shortfall: 'कहीं से नहीं मिले, इसलिए बजट से ज़्यादा दिखते हैं',
  reason: {
    guestsChanged: (percent) =>
      percent > 0
        ? `मेहमान बदले; यह पंक्ति मेहमानों के साथ ${String(percent)} प्रतिशत बढ़ती है`
        : 'मेहमान बदले',
    budgetChanged: 'बजट बदला',
    eventDateMoved: 'तारीख़ खिसकी',
    reallocated: 'पैसा हटाया',
    rankingFlipped: (guests) =>
      guests === '' ? 'सबसे सस्ता कोटेशन बदला' : `${guests} मेहमानों पर सबसे सस्ता कोटेशन बदला`,
    taskDelayed: (task) => `देर हुई: ${task}`,
    leverApplied: (lever) => `चुना गया समझौता: ${lever}`,
    taskDone: (task) => `पूरा: ${task}`,
    quoteAdded: (vendor) => `कोटेशन जुड़ा: ${vendor}`,
  },
  keptHeading: 'बरक़रार',
  keptIntro: 'ये फ़ैसले बिना बदले आगे चलते हैं।',
  askAgainHeading: 'बरक़रार, दोबारा पूछें',
  askAgainIntro:
    'बरक़रार, पर वेंडर ने पुराने मेहमानों या तारीख़ पर हामी भरी थी, इसलिए उनसे पक्का करें।',
  changedHeading: 'इस क़दम से बदले',
  none: 'कोई नहीं।',
  decision: {
    priority: (category, level) => `${category}: ${level}`,
    mustHave: (item) => `ज़रूरी: ${item}`,
    need: (item) => `जिन मेहमानों का ख़याल रखना है: ${item}`,
    diet: (item) => `खाना: ${item}`,
    venueLimit: (item) => `वेन्यू: ${item}`,
    function: (name, answer) => `${name}: ${answer}`,
    booking: (category) => `${category} बुक`,
    quote: (vendor) => `${vendor} का कोटेशन`,
    taskDone: (task) => `पूरा: ${task}`,
    taskDelayed: (task, date) => `${task}: ${date} से पहले नहीं`,
    lever: (lever) => `समझौता: ${lever}`,
  },
  reconfirmHeading: 'इन वेंडरों से दोबारा पूछें',
  reconfirmIntro:
    'हर एक ने उन शर्तों पर हामी भरी थी जिनसे योजना अब हट गई है। उन्हें ये सवाल भेजें।',
  reconfirmNone: 'किसी वेंडर से दोबारा पक्का करने की ज़रूरत नहीं।',
  needsReconfirmation: 'दोबारा पक्का करना है',
  reconfirmReason: {
    date: 'तारीख़ खिसकी',
    guests: 'मेहमानों की संख्या बदली',
    capacity: 'मेहमान बुक की गई क्षमता से ज़्यादा हैं',
    'cap-exceeded': 'मेहमान कोटेशन की सीमा से ज़्यादा हैं: नया कोटेशन चाहिए',
  },
  undo: 'पिछला क़दम वापस लें',
  undoHint:
    'सबसे हाल का क़दम हटता है, चाहे वह कुछ भी हो। योजना उससे पहले वाले संस्करण पर लौटती है।',
  backToPlan: 'योजना पर वापस',
};
