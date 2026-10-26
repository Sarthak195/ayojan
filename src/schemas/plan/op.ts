import { z } from 'zod';

import { LeverId, TaskId } from '../generated/ids';
import { Category, Priority } from '../readings/vocabulary';
import { Brief, IsoDate, ReadBy } from './brief';
import { QuoteRecord } from './quote-record';
import { ShortText } from './short-text';

export const MAX_OPS = 40;

const amount = z.number().int().min(0).nullable();

// The plan is a fold of these confirmed ops; every number on screen is derived from them, so
// the ledger, the diff, the Kept list and Undo need no stored state of their own.
export const Op = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('briefConfirmed'), brief: Brief, readBy: ReadBy }),
  z.strictObject({ kind: z.literal('quoteAdded'), quote: QuoteRecord, readBy: ReadBy }),
  // The one booking path (D10): with an amount the task's `books` category is booked at it,
  // and a capacity overrides the brief's venue capacity; without one the task is just done.
  z.strictObject({
    kind: z.literal('taskDone'),
    taskId: TaskId,
    on: IsoDate,
    amountInr: amount,
    capacity: z.number().int().min(1).nullable(),
  }),
  // An absolute date computed at confirm time from the form's 1 to 60 days, so a shared link
  // opened later shows the same schedule (D11).
  z.strictObject({ kind: z.literal('taskDelayed'), taskId: TaskId, notBefore: IsoDate }),
  z.strictObject({
    kind: z.literal('changeConfirmed'),
    guests: z.number().int().min(1).nullable(),
    budgetInr: z.number().int().min(0).nullable(),
    eventDate: IsoDate.nullable(),
    reallocate: z.strictObject({ to: Category, amountInr: z.number().int().min(1) }).nullable(),
    // From the change form only (D13); never re-splits the budget (D09).
    priorities: z.record(Category, Priority).nullable(),
    sources: z.array(ShortText).max(3),
    readBy: ReadBy,
  }),
  z.strictObject({
    kind: z.literal('leversApplied'),
    leverIds: z.array(LeverId).max(8),
    raiseBudgetInr: amount,
  }),
]);
export type Op = z.infer<typeof Op>;
export type OpKind = Op['kind'];
