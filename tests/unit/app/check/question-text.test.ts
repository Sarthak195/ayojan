import { describe, expect, it } from 'vitest';

import { questionText } from '@/app/[lang]/p/[token]/check/question-text';
import type { BriefQuestion } from '@/core/brief/questions';
import type { FieldVerdict } from '@/schemas/plan/state-token';

const BUDGET_ASKED: BriefQuestion = {
  field: 'budget',
  reason: 'missing',
  given: null,
  bounds: null,
};

function unclear(quote: string): FieldVerdict {
  return { field: 'budget', status: 'unclear', reason: null, displayQuote: quote };
}

// An approximate single amount is asked, not guessed; the reason must not call it "not one amount".
describe('the budget question for words that are not an exact amount', () => {
  it.each(['dhai lakh ke aas paas', 'around 3 lakh, 2-3 lakh is fine'])(
    'explains "%s"',
    (quote) => {
      expect(questionText(BUDGET_ASKED, unclear(quote), 'en')).toBe(
        `We read "${quote}", but could not take one exact amount from it. Please fill this in. We do not guess it.`,
      );
      expect(questionText(BUDGET_ASKED, unclear(quote), 'hi')).toContain(
        `हमने "${quote}" पढ़ा, पर इससे कोई एक पक्की रक़म नहीं निकाल सके।`,
      );
    },
  );
});
