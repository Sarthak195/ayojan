import { z } from 'zod';

import { LeverId } from '../generated/ids';
import { TokenField, listOf } from './form-field';

// The trade-off chooser. The server recomputes every saving and total from the token; a
// client-side running total is never part of this form. A disabled lever, or a refused one
// without its "Show anyway" box, is a 422 decided by the route against the current plan.
export const LeverChoice = z.strictObject({
  token: TokenField,
  intent: z.enum(['preview', 'apply']),
  lever: listOf(LeverId, 8),
  showAnyway: listOf(LeverId, 8),
});
export type LeverChoice = z.infer<typeof LeverChoice>;
