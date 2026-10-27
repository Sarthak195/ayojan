import 'server-only';

import type { IsoDate } from '@/core/calendar/day-number';
import { resolveDayMonth } from '@/core/calendar/relative-date';
import { parseAmount } from '@/core/rupees/parse';
import { BUDGET_MAX_INR, BUDGET_MIN_INR, type FunctionAnswer } from '@/schemas/plan/brief';
import { toShortText } from '@/schemas/plan/short-text';
import { BriefReading } from '@/schemas/readings/brief-reading';
import type { Category, FunctionName, Presence, Priority } from '@/schemas/readings/vocabulary';
import * as brief from '@/server/prompts/brief';

import type { ReadingOutcome } from './reading-outcome';
import { runReader, type PendingValues, type ReaderDeps } from './run-reader';
import {
  dayMonthNumbers,
  isVerified,
  keptNumber,
  outOfBounds,
  presenceOf,
  presenceWith,
  spelled,
  whole,
  type Verdicts,
} from './verdicts';

// The confirmed brief's own limits (src/schemas/plan/brief.ts); a value outside them is asked.
const GUESTS = whole(1, 5_000);
const VENUE_CAPACITY = whole(1, 10_000);
const BUDGET = whole(BUDGET_MIN_INR, BUDGET_MAX_INR);

type DateReading = BriefReading['date'];

/**
 * A budget or guest count the model quoted as given but left without a number ("budget dedh
 * lakh", "do sau log") is read from the quote by the parser the form field uses, so the page
 * never asks for words code can read itself. The quote is still verified, a range stays a
 * question, a number outside the field's bounds is asked with its reason, and a figure the
 * model called unclear stays a question (D44).
 */
function quotedNumber(presence: Presence, value: number | null, quote: string): number | null {
  if (value !== null || presence !== 'present') return value;
  const parsed = parseAmount(quote);
  return parsed.kind === 'amount' ? parsed.inr : null;
}

/**
 * Code picks the year (the model never sees today). A date that resolves to a question, such
 * as one that has passed, keeps the date it named so the check page can show it with the reason.
 */
function readDate(date: DateReading, today: IsoDate, verdicts: Verdicts): string | null {
  const numbers = dayMonthNumbers(date.day, date.month, date.year);
  const presence = numbers.length === 0 && date.presence === 'present' ? 'unclear' : date.presence;
  const verdict = verdicts.verify({ presence, quote: date.quote, numbers });
  if (!isVerified(verdict) || date.day === null || date.month === null) {
    verdicts.record('date', verdict, true);
    return null;
  }
  const resolved = resolveDayMonth({ day: date.day, month: date.month, year: date.year }, today);
  if (resolved.kind === 'date') {
    verdicts.record('date', verdict, true);
    return resolved.date;
  }
  verdicts.record('date', outOfBounds(verdict), true);
  return resolved.date;
}

// Unmentioned functions are "not sure", never "no" (FR-3). A function the family said they
// will not hold is a claim like any other, so its quote is verified before it becomes "no".
function readFunctions(
  entries: BriefReading['functions'],
  verdicts: Verdicts,
): Record<FunctionName, FunctionAnswer> {
  const answers: Record<FunctionName, FunctionAnswer> = {
    haldi: 'unsure',
    mehndi: 'unsure',
    sangeet: 'unsure',
    wedding: 'unsure',
    reception: 'unsure',
  };
  const seen = new Set<FunctionName>();
  for (const entry of entries) {
    if (seen.has(entry.name)) continue;
    seen.add(entry.name);
    const said = entry.presence === 'absent' ? 'present' : entry.presence;
    const verdict = verdicts.check(`function.${entry.name}`, {
      presence: said,
      quote: entry.quote,
    });
    if (isVerified(verdict)) answers[entry.name] = entry.presence === 'absent' ? 'no' : 'yes';
  }
  return answers;
}

// A category the brief does not mention is "unclear", not a silent "standard": the user said
// nothing about it, and the check page decides how to ask.
function readPriorities(
  entries: BriefReading['priorities'],
  verdicts: Verdicts,
): Record<Category, Priority> {
  const levels: Record<Category, Priority> = {
    venue: 'unclear',
    catering: 'unclear',
    decor: 'unclear',
    photo: 'unclear',
    music: 'unclear',
    invites: 'unclear',
    contingency: 'unclear',
  };
  const seen = new Set<Category>();
  for (const entry of entries) {
    if (seen.has(entry.category)) continue;
    seen.add(entry.category);
    const claim = { presence: presenceOf(entry.level), quote: entry.quote };
    const verdict = verdicts.check(`priority.${entry.category}`, claim);
    if (isVerified(verdict)) levels[entry.category] = entry.level;
  }
  return levels;
}

interface Listed<T> {
  readonly item: T;
  readonly presence: 'present' | 'absent' | 'unclear';
  readonly quote: string;
}

/** The items whose presence is verified, each once, in reading order. */
function readList<T extends string>(
  prefix: string,
  entries: readonly Listed<T>[],
  verdicts: Verdicts,
): T[] {
  const kept: T[] = [];
  for (const entry of entries) {
    const verdict = verdicts.check(`${prefix}.${entry.item}`, entry);
    if (isVerified(verdict) && !kept.includes(entry.item)) kept.push(entry.item);
  }
  return kept;
}

// Kept in the user's own characters: these are shown as "Noted" and never planned with (D14).
function readNotes(reading: BriefReading, verdicts: Verdicts): string[] {
  const notes: string[] = [];
  const others = [...reading.otherMustHaves, ...reading.otherNeeds];
  others.forEach((other, index) => {
    const verdict = verdicts.check(`note.${String(index)}`, {
      presence: 'present',
      quote: other.quote,
    });
    if (isVerified(verdict) && verdict.displayQuote !== undefined) {
      notes.push(toShortText(verdict.displayQuote));
    }
  });
  return notes;
}

function buildBrief(reading: BriefReading, verdicts: Verdicts, today: IsoDate): PendingValues {
  const { occasion, venueCapacity, budget: said, guests: counted } = reading;
  const budget = { ...said, amountInr: quotedNumber(said.presence, said.amountInr, said.quote) };
  const guests = {
    ...counted,
    count: quotedNumber(counted.presence, counted.count, counted.quote),
  };
  const occasionVerdict = verdicts.check(
    'occasion',
    { presence: presenceOf(occasion.value), quote: occasion.quote },
    true,
  );
  const budgetVerdict = verdicts.check(
    'budget',
    {
      presence: presenceWith(budget.presence, budget.amountInr),
      quote: budget.quote,
      numbers: spelled(budget.amountInr, BUDGET),
    },
    true,
  );
  const guestsVerdict = verdicts.check(
    'guests',
    {
      presence: presenceWith(guests.presence, guests.count),
      quote: guests.quote,
      numbers: spelled(guests.count, GUESTS),
    },
    true,
  );
  const eventDate = readDate(reading.date, today, verdicts);
  const capacityVerdict = verdicts.check('venueCapacity', {
    presence: presenceWith(venueCapacity.presence, venueCapacity.count),
    quote: venueCapacity.quote,
    numbers: spelled(venueCapacity.count, VENUE_CAPACITY),
  });
  return {
    kind: 'brief',
    values: {
      occasion: isVerified(occasionVerdict) && occasion.value !== 'unclear' ? occasion.value : null,
      budgetInr: keptNumber(budgetVerdict, budget.amountInr),
      guests: keptNumber(guestsVerdict, guests.count),
      eventDate,
      venueCapacity: keptNumber(capacityVerdict, venueCapacity.count),
      functions: readFunctions(reading.functions, verdicts),
      priorities: readPriorities(reading.priorities, verdicts),
      mustHaves: readList(
        'mustHave',
        reading.mustHaves.map((entry) => ({ ...entry, presence: 'present' as const })),
        verdicts,
      ),
      needs: readList(
        'need',
        reading.guestNeeds.map(({ need, ...rest }) => ({ item: need, ...rest })),
        verdicts,
      ),
      diet: readList('diet', reading.diet, verdicts),
      venueLimits: readList('venueLimit', reading.venueLimits, verdicts),
      notes: readNotes(reading, verdicts),
    },
  };
}

export interface BriefInput {
  /** The brief exactly as the user pasted it; only its canonical copy reaches the model. */
  readonly text: string;
  /** Today in India, for picking the year of a date written without one. */
  readonly today: IsoDate;
}

/** Call 1 (G1): reads a brief into a pending reading for the check page, or the form twin. */
export function readBrief(deps: ReaderDeps, input: BriefInput): Promise<ReadingOutcome> {
  return runReader(deps, {
    kind: 'brief',
    prompt: brief,
    schema: BriefReading,
    text: input.text,
    build: (reading, verdicts) => buildBrief(reading, verdicts, input.today),
  });
}
