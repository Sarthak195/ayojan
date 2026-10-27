// Which vendors the family still has to approach, and what to ask them before any quote. A
// category is needed when a task in the plan books it, and still open while it has neither a
// quote nor a booking. The questions are rows of data/vendor-questions.yaml, chosen by code.

import { QuestionId } from '@/schemas/generated/ids';
import type { QuestionRow, VendorQuestionsFile } from '@/schemas/data/vendor-questions';
import type { Category, MustHave } from '@/schemas/readings/vocabulary';

import { categoriesTiedToMustHaves } from '../budget/must-have-categories';
import type { EnquiryInput, EnquiryQuestion, EnquiryVendor } from '../messages/enquiry-messages';
import type { EnquiryCategory } from '../messages/phrase-pack';
import { vendorQuestions, type VendorQuestion } from '../quotes/vendor-questions';
import type { PlanData } from './plan-data';
import { categoryLabel } from './plan-vendors';
import type { PlanVersion } from './plan-version';

const ENQUIRY_CATEGORIES: readonly EnquiryCategory[] = [
  'venue',
  'catering',
  'decor',
  'photo',
  'music',
];

// Enough for a vendor to quote on and still one WhatsApp screen or two. The family's own needs
// are never the ones cut: only the general price questions give way to them.
const MAX_QUESTIONS = 8;

function forCategory(row: QuestionRow, category: Category): boolean {
  return row.categories.length === 0 || row.categories.includes(category);
}

// What a first enquiry asks when there is room for only some of it, most decisive first: a
// vendor busy that day makes the rest moot, the caterer's per-plate minimum decides whether
// quotes can be compared at all, then the terms, what the price covers and the tax.
const GENERAL_PRIORITY: readonly string[] = [
  'available-on-date',
  'minimum-guarantee',
  'cancellation-terms',
  'price-includes',
  'tax-rate',
];

// Before a quote: only the rows above, and only those that read naturally with no price given.
// None has a placeholder (the data check says so for beforeQuote rows), so the opening line of
// the enquiry carries the date and the guest count.
function generalQuestions(rows: readonly QuestionRow[], category: Category): VendorQuestion[] {
  return rows
    .filter((row) => GENERAL_PRIORITY.includes(row.id) && forCategory(row, category))
    .sort((a, b) => GENERAL_PRIORITY.indexOf(a.id) - GENERAL_PRIORITY.indexOf(b.id))
    .map((row) => ({ id: row.id, en: row.en, hi: row.hi, raisedBy: row.raisedBy }));
}

function questionsFor(
  rows: VendorQuestionsFile['questions'],
  category: EnquiryCategory,
  version: PlanVersion,
): VendorQuestion[] {
  const { brief, headline } = version;
  // No quote and nothing to re-confirm, so only the plan's own conditions raise a row here:
  // must-haves, guest needs, diet and venue limits. No row of those kinds has a date in it.
  const all = vendorQuestions(
    rows,
    { category, quote: null, total: null },
    {
      mustHaves: brief.mustHaves,
      needs: brief.needs,
      diet: brief.diet,
      venueLimits: brief.venueLimits,
      reconfirm: [],
      values: { guests: headline.guests, capacity: headline.venue.capacity, date: null },
    },
  );
  // Its wording presumes a booking and a baraat; before a quote the must-have is stated instead.
  // A venue limit is only the venue's to answer, so other vendors are not asked it.
  const own = all.filter(
    (q) => q.id !== 'dhol-included' && (q.raisedBy.when !== 'venueLimit' || category === 'venue'),
  );
  const room = Math.max(0, MAX_QUESTIONS - own.length);
  return [...generalQuestions(rows, category).slice(0, room), ...own];
}

function withIds(questions: readonly VendorQuestion[]): EnquiryQuestion[] {
  return questions.flatMap((question) => {
    const id = QuestionId.safeParse(question.id);
    return id.success ? [{ id: id.data, en: question.en, hi: question.hi }] : [];
  });
}

function unaskedMustHaves(
  category: Category,
  questions: readonly VendorQuestion[],
  version: PlanVersion,
  data: PlanData,
): MustHave[] {
  return version.brief.mustHaves.filter(
    (item) =>
      categoriesTiedToMustHaves([item], data.tasks.tasks).includes(category) &&
      !questions.some((q) => q.raisedBy.when === 'mustHave' && q.raisedBy.mustHave === item),
  );
}

/** The categories still to approach, in vocabulary order, with their questions. */
export function enquiryInput(version: PlanVersion, data: PlanData): EnquiryInput {
  const booked = new Set<Category>(version.bookings.map((booking) => booking.category));
  const quoted = new Set<Category>(version.quotes.map((quote) => quote.category));
  // A booking task marked done without an amount still means that vendor is settled.
  const needed = new Set(
    version.schedule.tasks.filter((task) => !task.done).map((task) => task.books),
  );
  const vendors: EnquiryVendor[] = ENQUIRY_CATEGORIES.filter(
    (category) => needed.has(category) && !booked.has(category) && !quoted.has(category),
  ).map((category) => {
    const questions = questionsFor(data.vendorQuestions.questions, category, version);
    return {
      category,
      label: categoryLabel(data, version, category),
      questions: withIds(questions),
      mustHaves: unaskedMustHaves(category, questions, version, data),
    };
  });
  // Until the venue is settled the family has no hall to describe to other vendors.
  const venueOpen =
    vendors.some((vendor) => vendor.category === 'venue') ||
    (needed.has('venue') && !booked.has('venue'));
  return {
    occasion: version.brief.occasion,
    guests: version.headline.guests,
    eventDate: version.headline.eventDate,
    venueCapacity: venueOpen ? null : version.headline.venue.capacity,
    vendors,
  };
}
