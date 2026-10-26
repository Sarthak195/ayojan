// The start page (spec 6.1, D38): a general event planner, the brief box and the two ways round
// the AI reader (the example brief and the form twin). Both objects share one interface, so a
// key missing from either language fails `tsc`.

export interface StartDictionary {
  readonly title: string;
  readonly intro: string;
  readonly briefLabel: string;
  readonly briefHint: string;
  readonly readButton: string;
  readonly formFallback: string;
  readonly exampleHeading: string;
  readonly exampleButton: string;
  readonly exampleNote: string;
  readonly howHeading: string;
  readonly howRead: string;
  readonly howCheck: string;
  readonly howCompute: string;
}

export const en: StartDictionary = {
  title: 'Plan your event, and keep the plan when the family changes it',
  intro:
    'Ayojan plans a wedding, birthday, anniversary, puja or community event from the way you describe it. It splits your own budget, lists the tasks in order and keeps the plan when something changes.',
  briefLabel: 'Tell us about your event, the way you would tell family',
  briefHint: 'Hindi, English or Hinglish are all welcome. Up to 2,000 characters.',
  readButton: 'Read my brief',
  formFallback: 'If the AI reader is busy, use the form instead',
  exampleHeading: 'Want to see it first?',
  exampleButton: 'Try the example brief',
  exampleNote:
    'This sends a sample family wedding brief, and the check page labels it as an example. Your text box stays empty.',
  howHeading: 'How it works',
  howRead: 'Gemini reads your words and shows each value beside the words it came from.',
  howCheck: 'You check every value. Anything unclear becomes a question, never a guess.',
  howCompute:
    'Every rupee figure is computed in code from your own budget. Nothing is a market price.',
};

export const hi: StartDictionary = {
  title: 'अपने कार्यक्रम की योजना बनाइए, और परिवार के बदलाव के बाद भी योजना बनी रहे',
  intro:
    'आयोजन शादी, जन्मदिन, सालगिरह, पूजा या सामुदायिक कार्यक्रम की योजना आपके बताए तरीके से बनाता है। यह आपके अपने बजट को बाँटता है, काम क्रम से लिखता है और कुछ बदलने पर भी योजना सँभाले रखता है।',
  briefLabel: 'अपने कार्यक्रम के बारे में वैसे बताइए जैसे परिवार को बताते हैं',
  briefHint: 'हिन्दी, अंग्रेज़ी या हिंग्लिश, सब चलेगा। ज़्यादा से ज़्यादा 2,000 अक्षर।',
  readButton: 'मेरी बात पढ़िए',
  formFallback: 'अगर AI रीडर व्यस्त है, तो फ़ॉर्म भरिए',
  exampleHeading: 'पहले देखना चाहते हैं?',
  exampleButton: 'उदाहरण वाली बात आज़माइए',
  exampleNote:
    'इससे एक नमूना शादी का विवरण भेजा जाता है, और जाँच वाले पेज पर उसे उदाहरण लिखा जाता है। आपका टेक्स्ट बॉक्स खाली रहता है।',
  howHeading: 'यह कैसे काम करता है',
  howRead: 'Gemini आपके शब्द पढ़ता है और हर मान उन्हीं शब्दों के साथ दिखाता है जिनसे वह निकला।',
  howCheck: 'आप हर मान जाँचते हैं। जो साफ़ नहीं है, वह सवाल बनता है, अंदाज़ा नहीं।',
  howCompute:
    'हर रुपये का आँकड़ा आपके अपने बजट से कोड में निकाला जाता है। कोई भी बाज़ार भाव नहीं है।',
};
