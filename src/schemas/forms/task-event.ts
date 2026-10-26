import { z } from 'zod';

import { OptionalInteger, TokenField } from './form-field';

export const MAX_DELAY_DAYS = 60;

// The task id is text here, not the generated enum: an unknown or inactive task is a 422 from
// the route (the request is well formed but names nothing it can act on), not a 400.
const taskId = z.string().min(1).max(64);

const DelayDays = z
  .string()
  .regex(/^\d{1,2}$/)
  .transform(Number)
  .refine(
    (days) => days >= 1 && days <= MAX_DELAY_DAYS,
    `A delay is 1 to ${String(MAX_DELAY_DAYS)} days.`,
  );

export const TaskEvent = z.discriminatedUnion('event', [
  // Done, optionally with the amount that books the task's category and the booked capacity.
  z.strictObject({
    token: TokenField,
    taskId,
    event: z.literal('done'),
    amountInr: OptionalInteger.optional(),
    capacity: OptionalInteger.optional(),
  }),
  z.strictObject({ token: TokenField, taskId, event: z.literal('delayed'), days: DelayDays }),
]);
export type TaskEvent = z.infer<typeof TaskEvent>;
