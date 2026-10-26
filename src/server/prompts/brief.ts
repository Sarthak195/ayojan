import 'server-only';

import {
  Category,
  Diet,
  FunctionName,
  GuestNeed,
  MustHave,
  Occasion,
  Priority,
  VenueLimit,
} from '@/schemas/readings/vocabulary';

import { composeInput, composeSystem } from './shared/guardrails';

// Value lists come from the schema enums so a renamed value cannot leave the prompt stale.
const list = (values: readonly string[]): string => values.join(', ');

export const id = 'brief';
export const version = 1;

export const system = composeSystem(
  [
    'Task: read an event brief written by a family in India planning a celebration such as a wedding, birthday, anniversary, puja or community event. The brief may be in English, in Hindi (Devanagari script) or in Hinglish (Hindi in Latin letters mixed with English). Read all three the same way and quote the words in the form they were written.',
    '',
    'Fill the BriefReading schema. Its fields, named exactly as the schema names them:',
    `- occasion: value is one of ${list(Occasion.options)}, or unclear; quote the words that name the occasion.`,
    '- budget: presence; amountInr is the total budget in rupees as a whole number, with a written lakh or crore expanded into rupees; a range or a budget per person is unclear; quote.',
    '- guests: presence; count is the number of guests as written; a range is unclear; quote.',
    '- venueCapacity: presence; count is how many people the venue holds, only when the text states a capacity; quote.',
    '- date: presence; day, month (1 to 12) and year are filled only as written, year null when no year is written; a vague date such as "end of February" or "Feb end mein" is unclear with day, month and year null. Never work out a year, a weekday or a date from today; quote.',
    `- functions: one entry per function the text names, at most 5. name is one of ${list(FunctionName.options)}; presence is present when the family will hold it, absent when they say they will not, unclear when undecided; quote.`,
    `- priorities: one entry per category the text gives a spending priority for, at most 7. category is one of ${list(Category.options)} (photo covers photography and video, music covers music and entertainment, invites covers invitations and return gifts, contingency is the buffer). level is one of ${list(Priority.options)}: more when they want to spend more or invest in it, save when they want to cut or keep it simple, standard when they say it is normal, unclear otherwise; quote.`,
    `- mustHaves: at most 4. item is one of ${list(MustHave.options)} (dhol covers a dhol or baraat band, liveCounter covers a live food counter); quote.`,
    `- guestNeeds: at most 3. need is one of ${list(GuestNeed.options)}; presence; quote.`,
    `- diet: at most 3. item is one of ${list(Diet.options)}; presence; quote.`,
    `- venueLimits: at most 2. item is one of ${list(VenueLimit.options)}; presence; quote.`,
    '- otherMustHaves: at most 3 things the family insists on that no mustHaves item covers, each only a verbatim quote, such as "DJ chahiye".',
    '- otherNeeds: at most 3 guest needs or limits that no guestNeeds, diet or venueLimits item covers, each only a verbatim quote, such as "nut allergy".',
    '',
    'Leave an array empty when the text mentions nothing for it. List only what the family wrote: never add a function, priority, must-have or need they did not mention.',
  ].join('\n'),
);

/** The model input for one brief: the delimited text, then the request. */
export function instruction(text: string): string {
  return composeInput(
    text,
    'Read the brief above into the BriefReading schema. Quote the exact words for every value you fill, and return unclear or absent for anything you cannot quote.',
  );
}
