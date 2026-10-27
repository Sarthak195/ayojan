// Hindi words for the revision page; the interface and English are in revision.ts.

import type { RevisionDictionary } from './revision';

export const hi: RevisionDictionary = {
  title: (version) => `v${String(version)} में क्या बदला`,
  noChangeTitle: 'अभी कोई बदलाव नहीं',
  noChangeBody:
    'इस योजना में अभी कोई पक्का बदलाव नहीं है। योजना पर "क्या बदला?" में बताइए क्या बदला।',
  statusOver: (version, amount) =>
    `बदलाव लागू: योजना v${String(version)}, बजट से ${amount} ज़्यादा।`,
  statusWithin: (version, amount) =>
    `बदलाव लागू: योजना v${String(version)}, बजट में ${amount} बचे।`,
  statusNotPriced: (version) =>
    `बदलाव लागू: योजना v${String(version)}। अभी दाम नहीं लगे: तुलना के लिए कोटेशन या बुकिंग जोड़ें।`,
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
    'बरक़रार, पर विक्रेता ने पुराने मेहमानों या तारीख़ पर हामी भरी थी, इसलिए उनसे पक्का करें।',
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
  reconfirmHeading: 'इन विक्रेताओं से दोबारा पूछें',
  reconfirmIntro:
    'हर एक ने उन शर्तों पर हामी भरी थी जिनसे योजना अब हट गई है। उन्हें ये सवाल भेजें।',
  reconfirmNone: 'किसी विक्रेता से दोबारा पक्का करने की ज़रूरत नहीं।',
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
