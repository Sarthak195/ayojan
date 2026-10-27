import type { PhrasePack } from './phrase-pack';

// Simple spoken Hindi, the register a family WhatsApp group uses, not formal Hindi.
export const HINDI: PhrasePack = {
  templateLabel: 'टेम्पलेट, आँकड़े आपकी योजना से',
  months: [
    'जनवरी',
    'फ़रवरी',
    'मार्च',
    'अप्रैल',
    'मई',
    'जून',
    'जुलाई',
    'अगस्त',
    'सितंबर',
    'अक्टूबर',
    'नवंबर',
    'दिसंबर',
  ],
  occasion: {
    wedding: 'शादी',
    birthday: 'जन्मदिन',
    anniversary: 'सालगिरह',
    puja: 'पूजा',
    communityEvent: 'सामुदायिक कार्यक्रम',
    other: 'कार्यक्रम',
  },
  diet: { vegOnly: 'सिर्फ़ शाकाहारी खाना', jain: 'जैन खाना', noAlcohol: 'शराब नहीं' },
  venueLimit: { indoorOnly: 'सब कुछ अंदर', musicCurfew: 'जगह पर संगीत बंद करने का समय' },
  quoteField: {
    taxRate: 'टैक्स की दर',
    minimumGuests: 'कम से कम प्लेट',
    guestsCovered: 'कितने मेहमान शामिल हैं',
    rateAboveMinimum: 'कम से कम से ज़्यादा पर रेट',
    days: 'दिनों की गिनती',
  },
  status: { atRisk: 'जोखिम में' },
  sentences: {
    title: (occasion, date) => `हमारी ${occasion} (${date}) की ताज़ा जानकारी।`,
    daysToGo: (days) => `${String(days)} दिन बाक़ी हैं।`,
    standing: 'योजना अभी यहाँ तक पहुँची है।',
    nothingChanged: 'बजट, मेहमानों की गिनती और तारीख़ नहीं बदली।',
    budgetChanged: (now, before) => `बजट अब ${now} है (पहले ${before} था)।`,
    guestsChanged: (now, before) =>
      `अब हमें ${String(now)} मेहमानों की उम्मीद है (पहले ${String(before)} थे)।`,
    dateChanged: (now, before) => `तारीख़ अब ${now} है (पहले ${before} थी)।`,
    spend: (projected, budget) => `अनुमानित ख़र्च ${projected} है, और बजट ${budget} है।`,
    over: (gap) => `हम बजट से ${gap} ऊपर हैं।`,
    onBudget: 'हम ठीक बजट पर हैं।',
    notPriced:
      'अभी किसी चीज़ के दाम नहीं लगे हैं, इसलिए बजट के हिसाब से हम कहाँ हैं, यह अभी नहीं कह सकते।',
    under: (headroom) => `हम बजट के अंदर हैं, ${headroom} बचे हैं।`,
    levers: (items) => `बजट सँभालने के लिए हमने चुना: ${items}।`,
    leverSaves: (label, amount) => `${label} (${amount} बचेंगे)`,
    leverAdds: (label, amount) => `${label} (${amount} बढ़ेंगे)`,
    attention: (items) => `ध्यान देने वाले काम: ${items}।`,
    attentionItem: (name, status, due) => `${name} (${status}, आख़िरी तारीख़ ${due})`,
    // आख़िरी तारीख़ has no tense, so it holds for a date already gone; matches attentionItem.
    lateItem: (name, due, start) =>
      start === 'on'
        ? `${name} (समय से पीछे, आख़िरी तारीख़ ${due})`
        : `${name} (समय से पीछे, आख़िरी तारीख़ ${due}: ${start === 'today' ? 'आज ही शुरू करें' : 'पिछला काम होते ही शुरू करें'})`,
    vendors: (count, names) => `हम ${String(count)} वेंडर से सवाल पूछेंगे: ${names}।`,
    unclear: (items) => `क़ीमत की ये बातें अभी साफ़ नहीं हैं: ${items}।`,
    unclearItem: (vendor, fields) => `${vendor} (${fields})`,
    keptInMind: (items) => `ध्यान में रखा है: ${items}।`,
    signOff: 'हम आपको बताते रहेंगे।',
  },
  vendor: {
    greeting: 'नमस्ते,',
    intro: (occasion, date, guests) =>
      `यह हमारी ${occasion} (${date}) के बारे में है, लगभग ${String(guests)} मेहमानों के लिए।`,
    ask: 'क्या आप इन सवालों में मदद कर सकते हैं?',
    thanks: 'धन्यवाद।',
  },
  enquiry: {
    intro: (occasion, date, guests, seeking) =>
      `हमारे यहाँ ${date} को ${occasion} है। लगभग ${String(guests)} मेहमान होंगे, और हमें ${seeking} चाहिए।`,
    seeking: {
      venue: 'वेन्यू',
      catering: 'कैटरर',
      decor: 'सजावट करने वाले',
      photo: 'फ़ोटोग्राफ़र',
      music: 'संगीत (बैंड या DJ)',
    },
    venueHolds: (capacity) => `हमारे वेन्यू में ${String(capacity)} लोगों तक की जगह है।`,
    mustHave: {
      dhol: 'ढोल',
      mehndiArtist: 'मेहंदी लगाने वाले',
      liveCounter: 'लाइव काउंटर',
      choreographer: 'कोरियोग्राफ़र',
    },
    alsoWant: (items) => `हमें ये भी चाहिए: ${items}।`,
    close: 'कृपया इन बातों के साथ अपनी क़ीमत भेजें। धन्यवाद।',
  },
};
