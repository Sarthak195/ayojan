import { isoDate, PLAN_DATA, today } from '../plan/plan-fixture';

import { emptyDraft, type BriefAnswers, type BriefDraft } from '@/core/brief/brief-draft';
import { resolveBrief, type BriefContext, type BriefResolution } from '@/core/brief/confirm-brief';
import type { BriefQuestion } from '@/core/brief/questions';

export { isoDate, today };

export const CONTEXT: BriefContext = { today, weights: PLAN_DATA.budgetWeights };

/** A reading that verified everything the Hinglish brief says (spec 5.1) and nothing else. */
export const READ_DRAFT: BriefDraft = {
  ...emptyDraft(),
  occasion: 'wedding',
  budgetInr: 800_000,
  guests: 200,
  eventDate: '2027-02-26',
};

export function settle(
  changes: Partial<BriefDraft> = {},
  answers: BriefAnswers = {},
): BriefResolution {
  return resolveBrief({ draft: { ...READ_DRAFT, ...changes }, answers }, CONTEXT);
}

/** Only the questions raised, so a table can say "exactly this field and this reason". */
export function asked(
  resolution: BriefResolution,
): readonly Pick<BriefQuestion, 'field' | 'reason'>[] {
  return resolution.ok ? [] : resolution.questions.map(({ field, reason }) => ({ field, reason }));
}
