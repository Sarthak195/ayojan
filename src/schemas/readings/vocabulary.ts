import { z } from 'zod';

// The model's whole vocabulary. Every enum is closed so a reply cannot name a category, item
// or decision the engines do not know, and an injected instruction has no field to land in.

export const categories = [
  'venue',
  'catering',
  'decor',
  'photo',
  'music',
  'invites',
  'contingency',
] as const;

// Named occasions rather than wedding or other, so a birthday or a puja reads as itself; which
// budget profile each one uses is a lookup in data/budget-weights.yaml, not code (D38).
export const occasions = [
  'wedding',
  'birthday',
  'anniversary',
  'puja',
  'communityEvent',
  'other',
] as const;

export const Occasion = z.enum(occasions);
export type Occasion = z.infer<typeof Occasion>;

export const OccasionOrUnclear = z.enum([...occasions, 'unclear']);
export type OccasionOrUnclear = z.infer<typeof OccasionOrUnclear>;

export const Presence = z.enum(['present', 'absent', 'unclear']);
export type Presence = z.infer<typeof Presence>;

export const Category = z.enum(categories);
export type Category = z.infer<typeof Category>;

// One flat enum rather than a union with a literal branch: support for `const` in Gemini's
// schema subset is unverified, while a plain string enum is known to work.
export const CategoryOrUnclear = z.enum([...categories, 'unclear']);
export type CategoryOrUnclear = z.infer<typeof CategoryOrUnclear>;

export const Priority = z.enum(['more', 'standard', 'save', 'unclear']);
export type Priority = z.infer<typeof Priority>;

export const MustHave = z.enum(['dhol', 'mehndiArtist', 'liveCounter', 'choreographer']);
export type MustHave = z.infer<typeof MustHave>;

export const GuestNeed = z.enum(['elderly', 'children', 'wheelchair']);
export type GuestNeed = z.infer<typeof GuestNeed>;

export const Diet = z.enum(['vegOnly', 'jain', 'noAlcohol']);
export type Diet = z.infer<typeof Diet>;

export const VenueLimit = z.enum(['indoorOnly', 'musicCurfew']);
export type VenueLimit = z.infer<typeof VenueLimit>;

export const FunctionName = z.enum(['haldi', 'mehndi', 'sangeet', 'wedding', 'reception']);
export type FunctionName = z.infer<typeof FunctionName>;

export const QuoteBasis = z.enum(['perPlate', 'lumpSum', 'perDay', 'unclear']);
export type QuoteBasis = z.infer<typeof QuoteBasis>;

export const TaxTreatment = z.enum([
  'included',
  'extraWithRate',
  'extraRateUnstated',
  'unclear',
  'absent',
]);
export type TaxTreatment = z.infer<typeof TaxTreatment>;

export const QUOTE_LIMIT_CHARACTERS = 160;

// The limit is stated here and in the prompt but not enforced on the reply: a longer quote
// makes that one field unverified, never the whole reply invalid (D36).
export const Quote = z
  .string()
  .describe(
    `Exact words copied from the text, unchanged and untranslated, at most ${String(QUOTE_LIMIT_CHARACTERS)} characters. Empty if absent.`,
  );
