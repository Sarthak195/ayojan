// Words every page shares: the shell (skip link, header, footer), provenance labels, status
// words and banners. Both objects are annotated with one interface, so a key missing from
// either language, or present in only one, fails `tsc`.

export interface CommonDictionary {
  readonly productName: string;
  readonly skipLink: string;
  readonly homeLink: string;
  readonly languageNav: string;
  readonly currentLanguage: string;
  /** D27: worded identically in the README and docs/DATA_HANDLING.md. */
  readonly privacyFooter: string;
  readonly provenance: {
    readonly yourNumber: string;
    readonly yourSplit: string;
    readonly fromQuote: (vendor: string) => string;
    readonly fromAQuote: string;
    readonly computed: string;
    readonly assumption: string;
    readonly assumptionPercent: (percent: number) => string;
  };
  readonly status: {
    readonly done: string;
    readonly late: string;
    readonly atRisk: string;
    readonly dueThisWeek: string;
    readonly onTrack: string;
  };
  readonly banner: {
    readonly noteWord: string;
    readonly warningWord: string;
    readonly aiUnavailable: (reason: string) => string;
    readonly aiReason: {
      readonly quota: string;
      readonly timeout: string;
      readonly nokey: string;
    };
    readonly smallCelebration: string;
    readonly shortNotice: (days: number) => string;
    readonly overBudget: string;
  };
  /** D16: shown under every read button. */
  readonly readingHint: string;
  /** D41: said under every read button, in the same <p> as readingHint. */
  readonly privacyHint: string;
  readonly optional: string;
  readonly scrollTableHint: string;
  /** WCAG 2.4.2: one short name per page, shown in the tab as "<name>: Ayojan". */
  readonly pageTitles: {
    readonly start: string;
    readonly form: string;
    readonly check: string;
    readonly quotes: string;
    readonly revision: string;
    readonly messages: string;
  };
}

export const en: CommonDictionary = {
  productName: 'Ayojan',
  skipLink: 'Skip to main content',
  homeLink: 'Ayojan, start page',
  languageNav: 'Language',
  currentLanguage: 'current language',
  privacyFooter:
    'We keep no database. Your plan is encrypted inside the link; Google Cloud request logs may hold the link.',
  provenance: {
    yourNumber: 'Your number',
    yourSplit: 'Your split (planning assumption)',
    fromQuote: (vendor) => `From ${vendor}'s message, unconfirmed`,
    fromAQuote: 'From a quote, unconfirmed',
    computed: 'Computed',
    assumption: 'Planning assumption',
    assumptionPercent: (percent) => `Planning assumption: about ${String(percent)} percent`,
  },
  status: {
    done: 'Done',
    late: 'Late',
    atRisk: 'At risk',
    dueThisWeek: 'Due this week',
    onTrack: 'On track',
  },
  banner: {
    noteWord: 'Note',
    warningWord: 'Warning',
    aiUnavailable: (reason) =>
      `The AI reader is unavailable right now (${reason}). Fill in this form; your plan is computed exactly the same way.`,
    aiReason: {
      quota: 'the daily quota is used up',
      timeout: 'it did not answer in time',
      nokey: 'no AI key is set up on this server',
    },
    smallCelebration: 'Using the small-celebration profile: planning assumptions, check them.',
    shortNotice: (days) =>
      `Short notice: the event is ${String(days)} ${days === 1 ? 'day' : 'days'} away. Some tasks may already be late.`,
    overBudget: 'Over budget by',
  },
  readingHint: 'Reading can take up to 40 seconds.',
  privacyHint:
    "Gemini's free tier may use what you send to improve Google's products, so leave out names and phone numbers.",
  optional: '(optional)',
  scrollTableHint: 'If the table is cut off, scroll sideways to see the rest.',
  pageTitles: {
    start: 'Start a plan',
    form: 'Tell us by form',
    check: 'Check what we read',
    quotes: 'Vendor quotes',
    revision: 'What changed',
    messages: 'Messages to send',
  },
};

export const hi: CommonDictionary = {
  productName: 'आयोजन',
  skipLink: 'मुख्य सामग्री पर जाएँ',
  homeLink: 'आयोजन, शुरुआती पेज',
  languageNav: 'भाषा',
  currentLanguage: 'अभी की भाषा',
  privacyFooter:
    'हम कोई डेटाबेस नहीं रखते। आपकी योजना लिंक के अंदर एन्क्रिप्ट रहती है; Google Cloud के अनुरोध लॉग में यह लिंक रह सकता है।',
  provenance: {
    yourNumber: 'आपकी संख्या',
    yourSplit: 'आपका बँटवारा (अनुमान)',
    fromQuote: (vendor) => `${vendor} के संदेश से, पक्का नहीं`,
    fromAQuote: 'कोटेशन से, पक्का नहीं',
    computed: 'हिसाब से निकाला',
    assumption: 'अनुमान',
    assumptionPercent: (percent) => `अनुमान: लगभग ${String(percent)} प्रतिशत`,
  },
  status: {
    done: 'हो गया',
    late: 'देर हो गई',
    atRisk: 'खतरे में',
    dueThisWeek: 'इस हफ़्ते करना है',
    onTrack: 'समय पर',
  },
  banner: {
    noteWord: 'ध्यान दें',
    warningWord: 'चेतावनी',
    aiUnavailable: (reason) =>
      `AI रीडर अभी उपलब्ध नहीं है (${reason})। यह फ़ॉर्म भरें; आपकी योजना बिल्कुल इसी तरह बनेगी।`,
    aiReason: {
      quota: 'आज का कोटा खत्म हो गया है',
      timeout: 'उसने समय पर जवाब नहीं दिया',
      nokey: 'इस सर्वर पर कोई AI कुंजी नहीं लगी है',
    },
    smallCelebration: 'छोटे समारोह वाला प्रोफ़ाइल लगा है: ये अनुमान हैं, इन्हें जाँच लें।',
    shortNotice: (days) =>
      `कम समय: कार्यक्रम में ${String(days)} दिन बचे हैं। कुछ काम शायद पहले ही देर से हैं।`,
    overBudget: 'बजट से ज़्यादा:',
  },
  readingHint: 'पढ़ने में 40 सेकंड तक लग सकते हैं।',
  privacyHint:
    'Gemini के मुफ़्त प्लान में आपकी भेजी जानकारी Google के प्रॉडक्ट बेहतर बनाने के लिए इस्तेमाल हो सकती है, इसलिए नाम और फ़ोन नंबर न डालें।',
  optional: '(वैकल्पिक)',
  scrollTableHint: 'तालिका कटी दिखे तो बाक़ी देखने के लिए बाएँ-दाएँ स्क्रॉल करें।',
  pageTitles: {
    start: 'योजना शुरू करें',
    form: 'फ़ॉर्म से बताइए',
    check: 'जो पढ़ा, उसे जाँचिए',
    quotes: 'विक्रेताओं के कोटेशन',
    revision: 'क्या बदला',
    messages: 'भेजने के लिए संदेश',
  },
};
