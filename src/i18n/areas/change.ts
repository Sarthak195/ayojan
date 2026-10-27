// The change box on the plan page and the change variant of the check page (spec 6.3, 6.4,
// FR-23, FR-24, FR-30). Functions take only strings and numbers, so the parity test can call
// every one with sample arguments.

type Direction = 'increase' | 'decrease' | 'none';
type VerdictField = 'guests' | 'budget' | 'dateShift' | 'dateWritten' | 'reallocate';

export interface ChangeDictionary {
  readonly boxHeading: string;
  readonly boxIntro: string;
  readonly textLabel: string;
  readonly textHint: string;
  readonly readButton: string;
  readonly exampleButton: string;
  readonly exampleNote: string;
  readonly formSummary: string;
  readonly formIntro: string;
  readonly guestsLabel: string;
  readonly budgetLabel: string;
  readonly dateLabel: string;
  readonly moveAmountLabel: string;
  readonly moveToLegend: string;
  readonly noMove: string;
  readonly priorityLegend: string;
  readonly priorityRow: (category: string) => string;
  readonly noChange: string;
  readonly formApply: string;
  readonly summaryQuestions: (count: number) => string;
  readonly summaryReady: string;
  readonly summaryBlocked: string;
  readonly readingHeading: string;
  readonly fields: Readonly<Record<VerdictField, string>>;
  readonly guestsDelta: (delta: number, total: number) => string;
  readonly guestsTotal: (total: number) => string;
  readonly direction: Readonly<Record<Direction, string>>;
  readonly amountNotGiven: string;
  readonly dateTo: (date: string) => string;
  readonly moveTo: (category: string) => string;
  readonly moveUnknown: string;
  readonly questionsHeading: string;
  readonly howMuch: (direction: string) => string;
  readonly percentOption: (percent: number) => string;
  readonly exactOption: string;
  readonly exactLabel: string;
  readonly whichDate: string;
  readonly shiftOption: (date: string) => string;
  readonly writtenOption: (date: string) => string;
  readonly nothingToChange: string;
  readonly guestsOutOfRange: (guests: number) => string;
  readonly budgetOutOfRange: (amount: string) => string;
  readonly datePassed: (date: string) => string;
  readonly moveUnclear: string;
  readonly guestsUnclear: string;
  readonly dateUnclear: string;
  readonly reenter: string;
  readonly apply: string;
  readonly applyHint: string;
}

export const en: ChangeDictionary = {
  boxHeading: 'What changed?',
  boxIntro:
    'Tell us what changed, the way you would tell family. Nothing changes until you check what we read.',
  textLabel: 'What changed',
  textHint: 'For example: 50 more guests, the budget is 7.5 lakh, the event is 2 weeks earlier.',
  readButton: 'Read the change',
  exampleButton: "Try the explainer's change",
  exampleNote:
    'This sends the sample sentence: 50 more guests, a smaller budget and the event 2 weeks earlier. Nothing changes until you check what we read.',
  formSummary: 'Use the form instead',
  formIntro: 'Leave a field empty, or on "No change", to keep it as it is.',
  guestsLabel: 'Guests (the new total)',
  budgetLabel: 'Total budget in Rs (the new total)',
  dateLabel: 'New date',
  moveAmountLabel: 'Move Rs',
  moveToLegend: 'Move that money to',
  noMove: 'No move',
  priorityLegend: 'Where to spend more or less',
  priorityRow: (category) => category,
  noChange: 'No change',
  formApply: 'Apply',
  summaryQuestions: (count) =>
    count === 1
      ? '1 question needs your answer before the change is applied.'
      : `${String(count)} questions need your answer before the change is applied.`,
  summaryReady: 'Everything needed is here. Check the values, then apply the change.',
  summaryBlocked: 'This change cannot be applied as we read it. Nothing in your plan has changed.',
  readingHeading: 'What we read',
  fields: {
    guests: 'Guests',
    budget: 'Budget',
    dateShift: 'Date moved',
    dateWritten: 'Date written',
    reallocate: 'Move money',
  },
  guestsDelta: (delta, total) =>
    `${delta >= 0 ? '+' : ''}${String(delta)}, so ${String(total)} guests`,
  guestsTotal: (total) => `${String(total)} guests`,
  direction: { increase: 'Increased', decrease: 'Decreased', none: 'Changed' },
  amountNotGiven: 'the amount was not given',
  dateTo: (date) => `Moves to ${date}`,
  moveTo: (category) => `to ${category}`,
  moveUnknown: 'the category or the amount was not clear',
  questionsHeading: 'Your answers',
  howMuch: (direction) => `Budget ${direction.toLowerCase()}: by how much?`,
  percentOption: (percent) => `${String(percent)} percent`,
  exactOption: 'An exact amount',
  exactLabel: 'Exact new budget in Rs (for "An exact amount")',
  whichDate: 'Which date?',
  shiftOption: (date) => `${date} (the move you described)`,
  writtenOption: (date) => `${date} (the date you wrote)`,
  nothingToChange:
    'We found nothing to change in this message: no guests, budget, date or money to move.',
  guestsOutOfRange: (guests) =>
    `That makes ${String(guests)} guests. Please give a count from 1 to 5,000.`,
  budgetOutOfRange: (amount) =>
    `That makes the budget ${amount}. Please give a budget from Rs 5,000 to Rs 10 crore.`,
  datePassed: (date) => `${date} is today or has passed. Please give a date after today.`,
  moveUnclear: 'We could not tell how much money to move, or to which category.',
  guestsUnclear: 'We could not tell the new guest count.',
  dateUnclear: 'We could not tell the new date.',
  reenter:
    'Cancel, then use the form under "What changed?" on the plan, or write the change again.',
  apply: 'Apply this change',
  applyHint: 'Adds one step to the plan. "Undo last step" takes it back.',
};

export const hi: ChangeDictionary = {
  boxHeading: 'क्या बदला?',
  boxIntro:
    'जो बदला है, वैसे ही लिखिए जैसे परिवार को बताते हैं। जब तक आप हमारा पढ़ा हुआ जाँच न लें, कुछ नहीं बदलेगा।',
  textLabel: 'क्या बदला',
  textHint: 'जैसे: 50 मेहमान और, बजट अब 7.5 लाख, कार्यक्रम 2 हफ़्ते पहले।',
  readButton: 'बदलाव पढ़ें',
  exampleButton: 'उदाहरण वाला बदलाव आज़माइए',
  exampleNote:
    'इससे नमूना वाक्य भेजा जाता है: 50 मेहमान और, बजट थोड़ा कम और कार्यक्रम 2 हफ़्ते पहले। जब तक आप पढ़ी गई बात जाँच न लें, कुछ नहीं बदलता।',
  formSummary: 'इसके बजाय फ़ॉर्म भरें',
  formIntro: 'जो नहीं बदला, उसे ख़ाली या "कोई बदलाव नहीं" पर छोड़ दें।',
  guestsLabel: 'मेहमान (नई कुल संख्या)',
  budgetLabel: 'कुल बजट, रुपये में (नया कुल)',
  dateLabel: 'नई तारीख़',
  moveAmountLabel: 'इतने रुपये हटाएँ (Rs)',
  moveToLegend: 'यह पैसा किसमें डालें',
  noMove: 'कुछ नहीं हटाना',
  priorityLegend: 'कहाँ ज़्यादा या कम ख़र्च करें',
  priorityRow: (category) => category,
  noChange: 'कोई बदलाव नहीं',
  formApply: 'लागू करें',
  summaryQuestions: (count) =>
    count === 1
      ? 'बदलाव लागू करने से पहले 1 सवाल का जवाब ज़रूरी है।'
      : `बदलाव लागू करने से पहले ${String(count)} सवालों के जवाब ज़रूरी हैं।`,
  summaryReady: 'जो चाहिए वह सब यहाँ है। मान जाँचें, फिर बदलाव लागू करें।',
  summaryBlocked: 'जैसा हमने पढ़ा, यह बदलाव लागू नहीं हो सकता। आपकी योजना में कुछ नहीं बदला।',
  readingHeading: 'हमने क्या पढ़ा',
  fields: {
    guests: 'मेहमान',
    budget: 'बजट',
    dateShift: 'तारीख़ खिसकी',
    dateWritten: 'लिखी हुई तारीख़',
    reallocate: 'पैसा हटाना',
  },
  guestsDelta: (delta, total) =>
    `${delta >= 0 ? '+' : ''}${String(delta)}, यानी ${String(total)} मेहमान`,
  guestsTotal: (total) => `${String(total)} मेहमान`,
  direction: { increase: 'बढ़ा', decrease: 'घटा', none: 'बदला' },
  amountNotGiven: 'रक़म नहीं बताई गई',
  dateTo: (date) => `अब ${date}`,
  moveTo: (category) => `${category} में`,
  moveUnknown: 'श्रेणी या रक़म साफ़ नहीं थी',
  questionsHeading: 'आपके जवाब',
  howMuch: (direction) => `बजट ${direction}: कितना?`,
  percentOption: (percent) => `${String(percent)} प्रतिशत`,
  exactOption: 'एक तय रक़म',
  exactLabel: 'नया बजट, रुपये में ("एक तय रक़म" के लिए)',
  whichDate: 'कौन-सी तारीख़?',
  shiftOption: (date) => `${date} (जितना आपने खिसकाने को कहा)`,
  writtenOption: (date) => `${date} (जो तारीख़ आपने लिखी)`,
  nothingToChange: 'इस संदेश में बदलने को कुछ नहीं मिला: न मेहमान, न बजट, न तारीख़, न पैसा हटाना।',
  guestsOutOfRange: (guests) =>
    `इससे ${String(guests)} मेहमान होते हैं। कृपया 1 से 5,000 के बीच संख्या दें।`,
  budgetOutOfRange: (amount) =>
    `इससे बजट ${amount} होता है। कृपया Rs 5,000 से Rs 10 करोड़ के बीच बजट दें।`,
  datePassed: (date) => `${date} आज है या बीत चुकी है। कृपया आज के बाद की तारीख़ दें।`,
  moveUnclear: 'हम समझ नहीं पाए कि कितना पैसा, किस श्रेणी में हटाना है।',
  guestsUnclear: 'हम नई मेहमान संख्या समझ नहीं पाए।',
  dateUnclear: 'हम नई तारीख़ समझ नहीं पाए।',
  reenter: 'रद्द करें, फिर योजना पर "क्या बदला?" के नीचे फ़ॉर्म भरें, या बदलाव दोबारा लिखें।',
  apply: 'यह बदलाव लागू करें',
  applyHint: 'योजना में एक क़दम जुड़ता है। "पिछला क़दम वापस लें" से वह हट जाता है।',
};
