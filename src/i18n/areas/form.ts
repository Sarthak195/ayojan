// The brief form twin (spec 6.2) and the brief vocabulary it shares with the check page: the
// occasion picker (D38), functions, priorities, must-haves, needs, diet and venue limits. Labels
// are keyed by the schema's own enum values, so a new value without words fails `tsc`.

import type {
  Category,
  Diet,
  FunctionName,
  GuestNeed,
  MustHave,
  Occasion,
  Priority,
  VenueLimit,
} from '@/schemas/readings/vocabulary';
import type { FunctionAnswer } from '@/schemas/plan/brief';

export interface FormDictionary {
  readonly title: string;
  readonly intro: string;
  readonly occasionLegend: string;
  readonly occasions: Readonly<Record<Occasion, string>>;
  readonly budgetLabel: string;
  readonly guestsLabel: string;
  readonly dateLabel: string;
  readonly capacityLabel: string;
  readonly numberHint: string;
  readonly guestsHint: string;
  readonly capacityHint: string;
  readonly functionsLegend: string;
  readonly functionsHint: string;
  readonly functions: Readonly<Record<FunctionName, string>>;
  readonly functionAnswers: Readonly<Record<FunctionAnswer, string>>;
  readonly prioritiesLegend: string;
  readonly categories: Readonly<Record<Category, string>>;
  readonly priorityAnswers: Readonly<Record<Priority, string>>;
  readonly weddingOnlyTitle: string;
  readonly weddingOnlyHint: string;
  readonly weddingMustHavesLegend: string;
  readonly mustHavesLegend: string;
  readonly mustHaves: Readonly<Record<MustHave, string>>;
  readonly needsLegend: string;
  readonly needs: Readonly<Record<GuestNeed, string>>;
  readonly dietLegend: string;
  readonly diet: Readonly<Record<Diet, string>>;
  readonly venueLimitsLegend: string;
  readonly venueLimits: Readonly<Record<VenueLimit, string>>;
  readonly submit: string;
}

export const en: FormDictionary = {
  title: 'Tell us by form',
  intro:
    'Fill in what you know. The plan is computed exactly the same way as when the AI reader is used.',
  occasionLegend: 'What is the occasion?',
  occasions: {
    wedding: 'Wedding',
    birthday: 'Birthday',
    anniversary: 'Anniversary',
    puja: 'Puja',
    communityEvent: 'Community event',
    other: 'Other celebration',
  },
  budgetLabel: 'Total budget (Rs)',
  guestsLabel: 'Guests',
  dateLabel: 'Event date',
  capacityLabel: 'Venue capacity',
  numberHint: 'Digits or words, such as 8 lakh or dedh lakh.',
  guestsHint: 'About how many people, in digits or words, such as 250 or dhai sau.',
  capacityHint: 'How many guests the hall holds, if you know, such as 300.',
  functionsLegend: 'Which functions will you hold?',
  functionsHint: 'These are wedding functions. For another occasion, leave them at Not sure.',
  functions: {
    haldi: 'Haldi',
    mehndi: 'Mehndi',
    sangeet: 'Sangeet',
    wedding: 'Wedding ceremony',
    reception: 'Reception',
  },
  functionAnswers: { yes: 'Yes', no: 'No', unsure: 'Not sure' },
  prioritiesLegend: 'Where to spend more or less',
  categories: {
    venue: 'Venue',
    catering: 'Food and catering',
    decor: 'Decoration',
    photo: 'Photos and video',
    music: 'Music and entertainment',
    invites: 'Invitations',
    contingency: 'Contingency',
  },
  priorityAnswers: {
    more: 'Spend more',
    standard: 'Standard',
    save: 'Save here',
    unclear: 'Not sure',
  },
  weddingOnlyTitle: 'Wedding only',
  weddingOnlyHint:
    'Birthday, puja or another occasion? You can skip this part. Leave it closed and the answers stay at Not sure.',
  weddingMustHavesLegend: 'Wedding must-haves',
  mustHavesLegend: 'Must-haves',
  mustHaves: {
    dhol: 'Dhol',
    mehndiArtist: 'Mehndi artist',
    liveCounter: 'Live food counter',
    choreographer: 'Choreographer',
  },
  needsLegend: 'Guests who need care',
  needs: { elderly: 'Elderly guests', children: 'Children', wheelchair: 'Wheelchair users' },
  dietLegend: 'Food',
  diet: { vegOnly: 'Vegetarian only', jain: 'Jain food', noAlcohol: 'No alcohol' },
  venueLimitsLegend: 'Venue limits',
  venueLimits: { indoorOnly: 'Indoor only', musicCurfew: 'Music curfew' },
  submit: 'Make the plan',
};

export const hi: FormDictionary = {
  title: 'फ़ॉर्म से बताइए',
  intro: 'जो पता है वह भरिए। योजना ठीक वैसे ही बनेगी जैसे AI रीडर से बनती है।',
  occasionLegend: 'मौका क्या है?',
  occasions: {
    wedding: 'शादी',
    birthday: 'जन्मदिन',
    anniversary: 'सालगिरह',
    puja: 'पूजा',
    communityEvent: 'सामुदायिक कार्यक्रम',
    other: 'कोई और समारोह',
  },
  budgetLabel: 'कुल बजट (Rs)',
  guestsLabel: 'मेहमान',
  dateLabel: 'कार्यक्रम की तारीख़',
  capacityLabel: 'वेन्यू में कितने लोग आ सकते हैं',
  numberHint: 'अंक या शब्द, जैसे 8 लाख या डेढ़ लाख।',
  guestsHint: 'लगभग कितने लोग, अंकों या शब्दों में, जैसे 250 या ढाई सौ।',
  capacityHint: 'वेन्यू में कितने मेहमान आ सकते हैं, अगर पता हो, जैसे 300।',
  functionsLegend: 'कौन-कौन से फ़ंक्शन होंगे?',
  functionsHint: 'ये शादी के फ़ंक्शन हैं। किसी और मौके के लिए इन्हें "पता नहीं" पर छोड़ दें।',
  functions: {
    haldi: 'हल्दी',
    mehndi: 'मेहंदी',
    sangeet: 'संगीत',
    wedding: 'शादी की रस्में',
    reception: 'रिसेप्शन',
  },
  functionAnswers: { yes: 'हाँ', no: 'नहीं', unsure: 'पता नहीं' },
  prioritiesLegend: 'कहाँ ज़्यादा और कहाँ कम ख़र्च करें',
  categories: {
    venue: 'वेन्यू',
    catering: 'खाना और कैटरिंग',
    decor: 'सजावट',
    photo: 'फ़ोटो और वीडियो',
    music: 'संगीत और मनोरंजन',
    invites: 'निमंत्रण',
    contingency: 'अचानक के ख़र्च',
  },
  priorityAnswers: {
    more: 'ज़्यादा ख़र्च',
    standard: 'सामान्य',
    save: 'यहाँ बचत',
    unclear: 'पता नहीं',
  },
  weddingOnlyTitle: 'सिर्फ़ शादी के लिए',
  weddingOnlyHint:
    'जन्मदिन, पूजा या कोई और मौका? इस हिस्से को छोड़ सकते हैं। इसे बंद रखने पर जवाब "पता नहीं" ही रहते हैं।',
  weddingMustHavesLegend: 'शादी की ज़रूरी चीज़ें',
  mustHavesLegend: 'ज़रूरी चीज़ें',
  mustHaves: {
    dhol: 'ढोल',
    mehndiArtist: 'मेहंदी वाले',
    liveCounter: 'लाइव खाने का काउंटर',
    choreographer: 'कोरियोग्राफ़र',
  },
  needsLegend: 'जिन मेहमानों का ख़ास ध्यान रखना है',
  needs: { elderly: 'बुज़ुर्ग मेहमान', children: 'बच्चे', wheelchair: 'व्हीलचेयर वाले' },
  dietLegend: 'खाना',
  diet: { vegOnly: 'सिर्फ़ शाकाहारी', jain: 'जैन खाना', noAlcohol: 'शराब नहीं' },
  venueLimitsLegend: 'वेन्यू की पाबंदियाँ',
  venueLimits: { indoorOnly: 'सिर्फ़ अंदर', musicCurfew: 'संगीत पर समय की रोक' },
  submit: 'योजना बनाइए',
};
