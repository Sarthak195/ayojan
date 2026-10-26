// Every vendor the plan deals with, booked or quoted, with the questions to ask it (FR-20,
// FR-27, D14). The question rows and their wording come from data/vendor-questions.yaml; this
// module only decides which vendor each one is for and what changed since it agreed.

import type { QuoteSlot } from '@/schemas/plan/quote-record';
import type { Category } from '@/schemas/readings/vocabulary';

import type { ComparableTotal } from '../quotes/quote-types';
import { quoteLabel } from '../quotes/quote-wording';
import {
  vendorQuestions,
  type Reconfirmation,
  type VendorQuestion,
} from '../quotes/vendor-questions';
import { dateText } from '../messages/render-values';
import type { PlanData } from './plan-data';
import type { PlanVersion } from './plan-version';
import {
  sameVendor,
  type ReconfirmReason,
  type ReconfirmationItem,
  type VendorRef,
} from './reconfirmation';

export interface VendorContact {
  readonly vendor: VendorRef;
  readonly label: { readonly en: string; readonly hi: string };
  readonly questions: readonly VendorQuestion[];
  readonly reconfirm: readonly ReconfirmReason[];
  readonly status: 'needs-reconfirmation' | 'current';
  readonly bookedCapacity: number | null;
}

function categoryLabel(
  data: PlanData,
  version: PlanVersion,
  category: Category,
): { readonly en: string; readonly hi: string } {
  const profile = data.budgetWeights.profiles.find((row) => row.id === version.profile);
  const row = profile?.categories.find((line) => line.category === category);
  return { en: row?.en ?? category, hi: row?.hi ?? category };
}

function totalOf(version: PlanVersion, quoteId: QuoteSlot): ComparableTotal | null {
  for (const comparison of version.comparisons) {
    for (const row of comparison.rows) {
      if (row.key !== 'comparableTotal') continue;
      const cell = row.cells.find((candidate) => candidate.quoteId === quoteId);
      if (cell !== undefined) return cell;
    }
  }
  return null;
}

function asked(reasons: readonly ReconfirmReason[]): Reconfirmation[] {
  return reasons.filter((reason): reason is Reconfirmation => reason !== 'cap-exceeded');
}

function contact(
  vendor: VendorRef,
  label: VendorContact['label'],
  version: PlanVersion,
  items: readonly ReconfirmationItem[],
  data: PlanData,
): VendorContact {
  const reconfirm = items.find((item) => sameVendor(item.vendor, vendor))?.reasons ?? [];
  const quote =
    vendor.kind === 'quote'
      ? (version.quotes.find((candidate) => candidate.id === vendor.quoteId) ?? null)
      : null;
  const total = vendor.kind === 'quote' ? totalOf(version, vendor.quoteId) : null;
  const booking = version.bookings.find((candidate) => candidate.category === vendor.category);
  const bookedCapacity = vendor.kind === 'booking' ? (booking?.capacity ?? null) : null;
  const { brief, headline } = version;
  const plan = (language: 'en' | 'hi'): Parameters<typeof vendorQuestions>[2] => ({
    mustHaves: brief.mustHaves,
    needs: brief.needs,
    diet: brief.diet,
    venueLimits: brief.venueLimits,
    reconfirm: asked(reconfirm),
    values: {
      guests: headline.guests,
      capacity: headline.venue.capacity,
      date: dateText(headline.eventDate, language),
    },
  });
  const subject = { category: vendor.category, quote, total };
  // Each language gets its own date words; the question ids and order are the same in both.
  const english = vendorQuestions(data.vendorQuestions.questions, subject, plan('en'));
  const hindi = vendorQuestions(data.vendorQuestions.questions, subject, plan('hi'));
  const questions = english.map((question) => ({
    ...question,
    hi: hindi.find((other) => other.id === question.id)?.hi ?? question.hi,
  }));
  return {
    vendor,
    label,
    questions,
    reconfirm,
    status: reconfirm.length > 0 ? 'needs-reconfirmation' : 'current',
    bookedCapacity,
  };
}

/** Booked vendors first (in data order), then each quote in slot order. */
export function vendorContacts(
  version: PlanVersion,
  items: readonly ReconfirmationItem[],
  data: PlanData,
): readonly VendorContact[] {
  const contacts: VendorContact[] = [];
  for (const booking of version.bookings) {
    const name = categoryLabel(data, version, booking.category);
    const label = { en: `${name.en} (booked)`, hi: `${name.hi} (बुक किया)` };
    const vendor: VendorRef = {
      kind: 'booking',
      category: booking.category,
      taskId: booking.taskId,
    };
    contacts.push(contact(vendor, label, version, items, data));
  }
  for (const quote of version.quotes) {
    const label = { en: quoteLabel(quote, 'en'), hi: quoteLabel(quote, 'hi') };
    const vendor: VendorRef = { kind: 'quote', category: quote.category, quoteId: quote.id };
    contacts.push(contact(vendor, label, version, items, data));
  }
  return contacts;
}
