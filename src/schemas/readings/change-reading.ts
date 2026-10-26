import { z } from 'zod';

import { CategoryOrUnclear, Presence, Quote } from './vocabulary';

const count = z.number().int().nullable();

// Call 3. Relative dates come back as a day shift and written dates as day and month, so all
// date arithmetic stays in code; when both are present and disagree, code asks "Which date?".
// Priority changes have no field here: they come only from the change form (D13).
export const ChangeReading = z.object({
  guests: z.object({
    mode: z.enum(['absolute', 'delta', 'unclear', 'absent']),
    count,
    quote: Quote,
  }),
  budget: z.object({
    mode: z.enum(['absolute', 'delta', 'directionOnly', 'absent']),
    direction: z.enum(['increase', 'decrease', 'none']),
    amountInr: z.number().nullable(),
    quote: Quote,
  }),
  dateShift: z.object({
    presence: Presence,
    shiftDays: count.describe('Days to move the event: "2 weeks earlier" is -14.'),
    quote: Quote,
  }),
  dateWritten: z.object({
    presence: Presence,
    day: count,
    month: count,
    year: count,
    quote: Quote,
  }),
  reallocate: z.object({
    presence: Presence,
    to: CategoryOrUnclear,
    amountInr: z.number().nullable(),
    quote: Quote,
  }),
});
export type ChangeReading = z.infer<typeof ChangeReading>;
