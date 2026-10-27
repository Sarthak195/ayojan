// What a language must supply to write the family update. Each sentence receives text that is
// already formatted (amounts, dates), so no pack ever formats a rupee amount: that lives in
// one place, and the numbers in a message can only be the ones the facts hold.

import type { Category, Diet, MustHave, Occasion, VenueLimit } from '@/schemas/readings/vocabulary';

import type { UnclearQuoteField } from './fact-types';

export interface PhrasePack {
  /** The label every template carries, so it is never mistaken for an AI draft. */
  readonly templateLabel: string;
  readonly months: readonly string[];
  readonly occasion: Readonly<Record<Occasion, string>>;
  readonly diet: Readonly<Record<Diet, string>>;
  readonly venueLimit: Readonly<Record<VenueLimit, string>>;
  readonly quoteField: Readonly<Record<UnclearQuoteField, string>>;
  readonly status: Readonly<Record<'atRisk', string>>;
  readonly sentences: {
    readonly title: (occasion: string, date: string) => string;
    readonly daysToGo: (days: number) => string;
    readonly standing: string;
    readonly nothingChanged: string;
    readonly budgetChanged: (now: string, before: string) => string;
    readonly guestsChanged: (now: number, before: number) => string;
    readonly dateChanged: (now: string, before: string) => string;
    readonly spend: (projected: string, budget: string) => string;
    readonly over: (gap: string) => string;
    readonly onBudget: string;
    readonly notPriced: string;
    readonly under: (headroom: string) => string;
    readonly levers: (items: string) => string;
    readonly leverSaves: (label: string, amount: string) => string;
    readonly leverAdds: (label: string, amount: string) => string;
    readonly attention: (items: string) => string;
    readonly attentionItem: (name: string, status: string, due: string) => string;
    /**
     * A Late task says what to do, not "late, due by" a date still ahead (D45). It tells the
     * family to start today only when the plan page does; a task waiting on another or on a
     * recorded delay gets the wait, or no instruction when the date alone would be a guess.
     */
    readonly lateItem: (name: string, due: string, start: 'today' | 'after' | 'on') => string;
    /** The tasks past the first few, counted rather than listed. */
    readonly andMore: (count: number) => string;
    readonly vendors: (count: number, names: string) => string;
    readonly unclear: (items: string) => string;
    readonly unclearItem: (vendor: string, fields: string) => string;
    readonly keptInMind: (items: string) => string;
    readonly signOff: string;
  };
  readonly vendor: {
    readonly greeting: string;
    readonly intro: (occasion: string, date: string, guests: number) => string;
    readonly ask: string;
    readonly thanks: string;
  };
  /**
   * A first message to a vendor the family has no quote from yet. There is no slot for an
   * amount: a family that opens with its budget invites a quote pitched at that ceiling.
   */
  readonly enquiry: {
    readonly intro: (occasion: string, date: string, guests: number, seeking: string) => string;
    readonly seeking: Readonly<Record<EnquiryCategory, string>>;
    readonly venueHolds: (capacity: number) => string;
    readonly mustHave: Readonly<Record<MustHave, string>>;
    readonly alsoWant: (items: string) => string;
    readonly close: string;
  };
}

/** The categories a family hires a vendor for; invites and contingency have no task that books one. */
export type EnquiryCategory = Extract<Category, 'venue' | 'catering' | 'decor' | 'photo' | 'music'>;
