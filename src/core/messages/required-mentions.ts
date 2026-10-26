// Which questions a family-update draft must at least touch. A draft is prose, so a question
// counts as mentioned when the draft contains one of its topic words in the draft's language.
// Only the re-confirmation questions have topics: they are the ones a family update has to
// carry (a vendor will be asked again because something changed). Any other id falls back to
// the id itself, which a model is never expected to write, so asking for one is a deliberate act.

import type { Language } from '@/core/rupees/format';
import type { QuestionId } from '@/schemas/generated/ids';

type Topics = Readonly<Record<Language, readonly string[]>>;

const TOPICS: Readonly<Partial<Record<QuestionId, Topics>>> = {
  'date-reconfirmation': { en: ['date'], hi: ['तारीख'] },
  'guest-count-reconfirmation': { en: ['guest'], hi: ['मेहमान'] },
  'venue-capacity': { en: ['capacity', 'venue'], hi: ['क्षमता', 'जगह', 'हॉल'] },
  'guest-cap-exceeded': { en: ['quote', 'price'], hi: ['क़ीमत', 'कीमत', 'रेट'] },
};

// Decomposed and lower-cased on both sides, so a nukta written as one code point or two, or a
// capital letter, never decides whether a topic was mentioned.
function fold(text: string): string {
  return text.normalize('NFD').toLowerCase();
}

export function topicWords(id: QuestionId, language: Language): readonly string[] {
  return TOPICS[id]?.[language] ?? [id];
}

export function mentionsQuestion(draftText: string, id: QuestionId, language: Language): boolean {
  const folded = fold(draftText);
  return topicWords(id, language).some((word) => folded.includes(fold(word)));
}
