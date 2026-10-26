import { z } from 'zod';

import { Category, MustHave } from '../readings/vocabulary';
import { Bilingual, Percent, RowId, planningRow } from './planning-row';

const common = {
  id: RowId,
  ...planningRow,
  consequence: Bilingual,
  // A lever that would remove something the family named as a must-have is disabled.
  mustHaveConflicts: z.array(MustHave),
};

// No "switch to the cheaper quote" lever (the projection already takes the cheapest quote, so
// it would always save nothing) and no trim-guests lever (pre-cut; fewer guests is a change).
const LeverRow = z.discriminatedUnion('effect', [
  z.strictObject({
    effect: z.literal('percentOfCategory'),
    ...common,
    category: Category,
    percent: Percent.min(1).max(90),
    provenance: z.literal('assumption'),
    // Choosing the lever switches this task to its faster alternative, so the schedule shows
    // what the choice clears rather than a sentence claiming it.
    fasterAlternativeFor: RowId.nullable(),
  }),
  z.strictObject({
    effect: z.literal('halfContingency'),
    ...common,
    category: z.literal('contingency'),
    provenance: z.literal('exact'),
  }),
  z.strictObject({ effect: z.literal('raiseBudget'), ...common, provenance: z.literal('exact') }),
]);

export const LeversFile = z.strictObject({ levers: z.array(LeverRow).min(1) });
export type LeversFile = z.infer<typeof LeversFile>;
export type LeverRow = z.infer<typeof LeverRow>;
