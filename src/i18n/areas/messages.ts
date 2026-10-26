// The messages page (spec 6.7, C8, FR-34, FR-35). The template label itself comes from the
// message phrase packs in core, so the label and the text it labels can never drift apart.

/** The pipeline's TemplateReason, spelled out so the dictionary imports no server code. */
type TemplateReason = 'rejected-numbers' | 'missing-questions' | 'empty' | 'unavailable';

export interface MessagesDictionary {
  readonly title: string;
  readonly familyHeading: string;
  readonly familyBox: string;
  readonly vendorHeading: string;
  readonly vendorBox: (vendor: string) => string;
  readonly noVendors: string;
  readonly aiLabel: (checked: number) => string;
  readonly writeWithAi: string;
  readonly writeHint: string;
  readonly askedAlready: string;
  readonly templateBecause: Readonly<Record<TemplateReason, string>>;
  readonly unavailable: (reason: string) => string;
  readonly copy: string;
  readonly copied: string;
  readonly selectToCopy: string;
  readonly backToPlan: string;
}

export const en: MessagesDictionary = {
  title: 'Messages to send',
  familyHeading: 'For the family group',
  familyBox: 'Family update',
  vendorHeading: 'For your vendors',
  vendorBox: (vendor) => `Message for ${vendor}`,
  noVendors: 'No vendor needs a message yet. Add a quote or book a task first.',
  aiLabel: (checked) =>
    `AI draft, numbers checked against your plan: ${String(checked)} of ${String(checked)}`,
  writeWithAi: 'Write it with AI',
  writeHint: 'Writing can take up to 40 seconds. Every number is checked against your plan.',
  askedAlready: 'The AI was already asked for these numbers; the answer is above.',
  templateBecause: {
    'rejected-numbers':
      'The AI draft had a number that is not in your plan, so it is not shown. This is the template.',
    'missing-questions':
      'The AI draft left out a question your vendors must answer, so it is not shown. This is the template.',
    empty: 'The AI draft was empty, so it is not shown. This is the template.',
    unavailable: 'The AI could not write a draft, so this is the template.',
  },
  unavailable: (reason) =>
    `The AI writer is unavailable right now (${reason}). The template below uses the same numbers.`,
  copy: 'Copy',
  copied: 'Copied',
  selectToCopy: 'Select the text to copy it.',
  backToPlan: 'Back to the plan',
};

export const hi: MessagesDictionary = {
  title: 'भेजने के लिए संदेश',
  familyHeading: 'परिवार के ग्रुप के लिए',
  familyBox: 'परिवार के लिए जानकारी',
  vendorHeading: 'आपके विक्रेताओं के लिए',
  vendorBox: (vendor) => `${vendor} के लिए संदेश`,
  noVendors: 'अभी किसी विक्रेता को संदेश की ज़रूरत नहीं। पहले कोटेशन जोड़ें या कोई काम बुक करें।',
  aiLabel: (checked) =>
    `AI ड्राफ़्ट, संख्याएँ आपकी योजना से जाँची गईं: ${String(checked)} में से ${String(checked)}`,
  writeWithAi: 'AI से लिखवाएँ',
  writeHint: 'लिखने में 40 सेकंड तक लग सकते हैं। हर संख्या आपकी योजना से जाँची जाती है।',
  askedAlready: 'इन संख्याओं के लिए AI से पहले ही पूछा जा चुका है; जवाब ऊपर है।',
  templateBecause: {
    'rejected-numbers':
      'AI ड्राफ़्ट में ऐसी संख्या थी जो आपकी योजना में नहीं है, इसलिए वह नहीं दिखाया गया। यह टेम्पलेट है।',
    'missing-questions':
      'AI ड्राफ़्ट में विक्रेताओं से पूछा जाने वाला सवाल छूट गया, इसलिए वह नहीं दिखाया गया। यह टेम्पलेट है।',
    empty: 'AI ड्राफ़्ट ख़ाली था, इसलिए वह नहीं दिखाया गया। यह टेम्पलेट है।',
    unavailable: 'AI ड्राफ़्ट नहीं लिख सका, इसलिए यह टेम्पलेट है।',
  },
  unavailable: (reason) =>
    `AI लेखक अभी उपलब्ध नहीं है (${reason})। नीचे का टेम्पलेट इन्हीं संख्याओं से बना है।`,
  copy: 'कॉपी करें',
  copied: 'कॉपी हो गया',
  selectToCopy: 'कॉपी करने के लिए टेक्स्ट चुनें।',
  backToPlan: 'योजना पर लौटें',
};
