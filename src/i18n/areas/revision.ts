// The revision page (spec 6.6, FR-25 to FR-29, D29, D32): the diff of the latest change, the
// Kept lists with their counter, the vendors to ask again, and Undo. Functions take only
// strings and numbers, so the parity test can call every one with sample arguments.

type Reconfirm = 'date' | 'guests' | 'capacity' | 'cap-exceeded';

export interface RevisionDictionary {
  readonly title: (version: number) => string;
  readonly noChangeTitle: string;
  readonly noChangeBody: string;
  readonly statusOver: (version: number, amount: string) => string;
  readonly statusWithin: (version: number, amount: string) => string;
  readonly statusNotPriced: (version: number) => string;
  readonly statusNoChange: (version: number) => string;
  readonly laterSteps: (after: number, current: number) => string;
  readonly counter: (kept: number, total: number) => string;
  readonly diffHeading: string;
  readonly diffCaption: (before: number, after: number) => string;
  readonly diffNote: string;
  readonly whatColumn: string;
  readonly beforeColumn: string;
  readonly nowColumn: string;
  readonly whyColumn: string;
  readonly guests: string;
  readonly budget: string;
  readonly date: string;
  readonly projected: string;
  readonly gap: string;
  readonly over: string;
  readonly under: string;
  readonly venueFit: string;
  readonly fits: (guests: number, capacity: number) => string;
  readonly overCapacity: (guests: number, capacity: number) => string;
  readonly cheapestIn: (category: string) => string;
  readonly cheaper: (vendor: string) => string;
  readonly noQuote: string;
  readonly movedTo: (category: string) => string;
  /** Each follows an amount with its own provenance label, so they hold no number. */
  readonly fromHeadroom: string;
  readonly fromGiver: (category: string) => string;
  readonly shortfall: string;
  readonly reason: {
    readonly guestsChanged: (percent: number) => string;
    readonly budgetChanged: string;
    readonly eventDateMoved: string;
    readonly reallocated: string;
    readonly rankingFlipped: (guests: string) => string;
    readonly taskDelayed: (task: string) => string;
    readonly leverApplied: (lever: string) => string;
    readonly taskDone: (task: string) => string;
    readonly quoteAdded: (vendor: string) => string;
  };
  readonly keptHeading: string;
  readonly keptIntro: string;
  readonly askAgainHeading: string;
  readonly askAgainIntro: string;
  readonly changedHeading: string;
  readonly none: string;
  readonly decision: {
    readonly priority: (category: string, level: string) => string;
    readonly mustHave: (item: string) => string;
    readonly need: (item: string) => string;
    readonly diet: (item: string) => string;
    readonly venueLimit: (item: string) => string;
    readonly function: (name: string, answer: string) => string;
    readonly booking: (category: string) => string;
    readonly quote: (vendor: string) => string;
    readonly taskDone: (task: string) => string;
    readonly taskDelayed: (task: string, date: string) => string;
    readonly lever: (lever: string) => string;
  };
  readonly reconfirmHeading: string;
  readonly reconfirmIntro: string;
  readonly reconfirmNone: string;
  readonly needsReconfirmation: string;
  readonly reconfirmReason: Readonly<Record<Reconfirm, string>>;
  readonly undo: string;
  readonly undoHint: string;
  readonly backToPlan: string;
}

export const en: RevisionDictionary = {
  title: (version) => `What changed in v${String(version)}`,
  noChangeTitle: 'No change yet',
  noChangeBody:
    'This plan has no confirmed change yet. Tell us what changed under "What changed?" on the plan.',
  statusOver: (version, amount) =>
    `Change applied: plan v${String(version)}, over budget by ${amount}.`,
  statusWithin: (version, amount) =>
    `Change applied: plan v${String(version)}, ${amount} left in the budget.`,
  statusNotPriced: (version) =>
    `Change applied: plan v${String(version)}. Not priced yet: add a quote or a booking to compare.`,
  statusNoChange: (version) => `Plan v${String(version)} has no confirmed change yet.`,
  laterSteps: (after, current) =>
    `This compares the latest change (v${String(after)}); the plan is now at v${String(current)}.`,
  counter: (kept, total) =>
    `Revised, not restarted: ${String(kept)} of ${String(total)} decisions kept.`,
  diffHeading: 'What changed',
  diffCaption: (before, after) => `Plan v${String(before)} against v${String(after)}`,
  diffNote: 'Only rows that changed are listed. Figures come from your plan, not market prices.',
  whatColumn: 'What',
  beforeColumn: 'Before',
  nowColumn: 'Now',
  whyColumn: 'Why',
  guests: 'Guests',
  budget: 'Budget',
  date: 'Date',
  projected: 'Projected spend',
  gap: 'Against the budget',
  over: 'Over by',
  under: 'Left',
  venueFit: 'Venue fits',
  fits: (guests, capacity) => `Yes: ${String(guests)} within ${String(capacity)}`,
  overCapacity: (guests, capacity) => `No: ${String(guests)} > ${String(capacity)}`,
  cheapestIn: (category) => `Cheapest quote, ${category}`,
  cheaper: (vendor) => `${vendor} cheaper`,
  noQuote: 'No quote',
  movedTo: (category) => `Money moved to ${category}`,
  fromHeadroom: 'from money not yet planned',
  fromGiver: (category) => `from ${category}`,
  shortfall: 'could not be found, so it shows as over budget',
  reason: {
    guestsChanged: (percent) =>
      percent > 0
        ? `Guests changed; this line grows with guests at ${String(percent)} percent`
        : 'Guests changed',
    budgetChanged: 'Budget changed',
    eventDateMoved: 'Date moved',
    reallocated: 'Money moved',
    rankingFlipped: (guests) =>
      guests === '' ? 'Cheapest quote changed' : `Cheapest quote changed at ${guests} guests`,
    taskDelayed: (task) => `Delayed: ${task}`,
    leverApplied: (lever) => `Trade-off chosen: ${lever}`,
    taskDone: (task) => `Done: ${task}`,
    quoteAdded: (vendor) => `Quote added: ${vendor}`,
  },
  keptHeading: 'Kept',
  keptIntro: 'Decisions that carry over unchanged.',
  askAgainHeading: 'Kept, ask again',
  askAgainIntro: 'Kept, but the vendor agreed to the old guests or date, so confirm with them.',
  changedHeading: 'Changed by this step',
  none: 'None.',
  decision: {
    priority: (category, level) => `${category}: ${level}`,
    mustHave: (item) => `Must-have: ${item}`,
    need: (item) => `Guests who need care: ${item}`,
    diet: (item) => `Food: ${item}`,
    venueLimit: (item) => `Venue: ${item}`,
    function: (name, answer) => `${name}: ${answer}`,
    booking: (category) => `${category} booked`,
    quote: (vendor) => `Quote from ${vendor}`,
    taskDone: (task) => `Done: ${task}`,
    taskDelayed: (task, date) => `${task}: not before ${date}`,
    lever: (lever) => `Trade-off: ${lever}`,
  },
  reconfirmHeading: 'Ask these vendors again',
  reconfirmIntro:
    'Each one agreed to terms the plan has moved away from. Send them these questions.',
  reconfirmNone: 'No vendor needs to confirm again.',
  needsReconfirmation: 'Needs re-confirmation',
  reconfirmReason: {
    date: 'The date moved',
    guests: 'The guest count changed',
    capacity: 'Guests are above the booked capacity',
    'cap-exceeded': "Guests are above the quote's limit: re-quote needed",
  },
  undo: 'Undo last step',
  undoHint: 'Removes the latest step, whatever it was. The plan returns to the version before it.',
  backToPlan: 'Back to the plan',
};

// Hindi lives in its own module to keep each file under the 250-line cap.
export { hi } from './revision-hi';
