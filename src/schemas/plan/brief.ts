import { z } from 'zod';

import {
  Category,
  Diet,
  FunctionName,
  GuestNeed,
  MustHave,
  Priority,
  VenueLimit,
} from '../readings/vocabulary';
import { ShortText } from './short-text';

// A calendar date as YYYY-MM-DD. Plain Zod here: the day-number arithmetic belongs to
// src/core/calendar, and "after today" is checked there, because a schema has no clock.
export const IsoDate = z.iso.date();
export type IsoDate = z.infer<typeof IsoDate>;

export const BUDGET_MIN_INR = 5_000;
export const BUDGET_MAX_INR = 100_000_000;

export const FunctionAnswer = z.enum(['yes', 'no', 'unsure']);
export type FunctionAnswer = z.infer<typeof FunctionAnswer>;

// The confirmed brief. Records over the closed enums are exhaustive, so every function and
// every category has an explicit answer and nothing defaults silently.
export const Brief = z.strictObject({
  // 'other' selects the small-celebration profile (D15).
  occasion: z.enum(['wedding', 'other']),
  budgetInr: z.number().int().min(BUDGET_MIN_INR).max(BUDGET_MAX_INR),
  guests: z.number().int().min(1).max(5_000),
  eventDate: IsoDate,
  venueCapacity: z.number().int().min(1).max(10_000).nullable(),
  functions: z.record(FunctionName, FunctionAnswer),
  priorities: z.record(Category, Priority),
  mustHaves: z.array(MustHave).max(4),
  needs: z.array(GuestNeed).max(3),
  diet: z.array(Diet).max(3),
  venueLimits: z.array(VenueLimit).max(2),
  // Verified "other" must-haves and needs: shown as noted, never a decision input (D14).
  notes: z.array(ShortText).max(6),
});
export type Brief = z.infer<typeof Brief>;

export const ReadBy = z.strictObject({
  source: z.enum(['ai', 'ai-cached', 'example', 'form']),
  // The model that answered (interaction.model), never the one requested.
  model: z.string().max(40).nullable(),
  matched: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type ReadBy = z.infer<typeof ReadBy>;
