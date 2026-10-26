import 'server-only';

import { Category } from '@/schemas/readings/vocabulary';

import { composeSystem } from './shared/guardrails';

export const id = 'change';
export const version = 1;

export const system = composeSystem(
  [
    'Task: read a message from a family describing changes to an event plan they already have. It may be in English, in Hindi (Devanagari script) or in Hinglish (Hindi in Latin letters mixed with English). Read all three the same way and quote the words in the form they were written. You do not see the plan: report only what the message says changed.',
    '',
    'Fill the ChangeReading schema. Its fields, named exactly as the schema names them:',
    '- guests: mode is absolute when the message gives the new total number of guests, delta when it gives a change (count is positive for more guests and negative for fewer), unclear when it says the number changed without a clear number, absent when guests are not mentioned; count as written or null; quote.',
    '- budget: changes to the total budget only. mode is absolute when it gives the new total, delta when it gives the size of a change, directionOnly when it says the budget went up or down without an amount (such as "our budget has decreased a bit"), absent when the budget is not mentioned. direction is increase, decrease or none. amountInr is the new total for absolute, the size of the change as a positive number for delta, and null for directionOnly or absent; quote.',
    '- dateShift: a relative move of the event date. presence; shiftDays is the move in days, negative for earlier and positive for later, so "2 weeks earlier" is -14 (a week is 7 days). A move given in months, or with no clear length such as "thoda pehle", is unclear with shiftDays null; quote.',
    '- dateWritten: a new date written out. presence; day, month (1 to 12) and year only as written, year null when no year is written; a vague date is unclear with nulls; quote.',
    `- reallocate: more money for one category without changing the total budget, such as more for photography. presence; to is one of ${Category.options.join(', ')}, or unclear; amountInr is the amount to move as written, null when none is written; quote.`,
    '',
    "Report a relative date only as a day shift and a written date only as written: the app does all date arithmetic and never needs today's date from you. If the message gives both a shift and a written date, fill both. A change of priority has no field here; leave it out.",
  ].join('\n'),
);

/**
 * The request that follows the data block. It takes no text: the gateway wraps the text in the
 * delimiter itself (interactions.ts), so the text reaches the model exactly once.
 */
export function instruction(): string {
  return 'Read the change message above into the ChangeReading schema. Quote the exact words for every value you fill, and return unclear or absent for anything you cannot quote.';
}
