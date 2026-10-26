import { z } from 'zod';

import {
  Category,
  Diet,
  FunctionName,
  GuestNeed,
  MustHave,
  OccasionOrUnclear,
  Presence,
  Priority,
  Quote,
  VenueLimit,
} from './vocabulary';

const count = z.number().int().nullable();

// Call 1. The model returns day, month and an optional year, never a computed date, so neither
// the prompt nor the cache key carries today's date; code picks the year.
export const BriefReading = z.object({
  occasion: z.object({ value: OccasionOrUnclear, quote: Quote }),
  budget: z.object({ presence: Presence, amountInr: z.number().nullable(), quote: Quote }),
  guests: z.object({ presence: Presence, count, quote: Quote }),
  venueCapacity: z.object({ presence: Presence, count, quote: Quote }),
  date: z.object({
    presence: Presence.describe(
      'A vague date such as "end of February" is unclear, never a guess.',
    ),
    day: count,
    month: count,
    year: count,
    quote: Quote,
  }),
  functions: z.array(z.object({ name: FunctionName, presence: Presence, quote: Quote })).max(5),
  priorities: z.array(z.object({ category: Category, level: Priority, quote: Quote })).max(7),
  mustHaves: z.array(z.object({ item: MustHave, quote: Quote })).max(4),
  guestNeeds: z.array(z.object({ need: GuestNeed, presence: Presence, quote: Quote })).max(3),
  diet: z.array(z.object({ item: Diet, presence: Presence, quote: Quote })).max(3),
  venueLimits: z.array(z.object({ item: VenueLimit, presence: Presence, quote: Quote })).max(2),
  // Shown as "Noted, not planned by this app" and never a decision input (D14), so a closed
  // enum does not silently drop what the family asked for.
  otherMustHaves: z.array(z.object({ quote: Quote })).max(3),
  otherNeeds: z.array(z.object({ quote: Quote })).max(3),
});
export type BriefReading = z.infer<typeof BriefReading>;
