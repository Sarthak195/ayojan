// Which vendors must confirm again after a change (architecture 4.8, FR-27). A vendor the family
// booked or got a quote from before the latest change agreed to the old date and guest count,
// so the app does not assume the deal holds: it marks the vendor "Needs re-confirmation" and
// says what to ask. Vendors booked or quoted after the change already knew the new terms.

import type { QuoteSlot } from '@/schemas/plan/quote-record';
import type { Category } from '@/schemas/readings/vocabulary';

import type { Booking } from '../timeline/task-progress';
import type { PlanVersion } from './plan-version';

export type ReconfirmReason = 'date' | 'guests' | 'capacity' | 'cap-exceeded';

export type VendorRef =
  | { readonly kind: 'booking'; readonly category: Category; readonly taskId: string }
  | { readonly kind: 'quote'; readonly category: Category; readonly quoteId: QuoteSlot };

export interface ReconfirmationItem {
  readonly vendor: VendorRef;
  readonly reasons: readonly ReconfirmReason[];
  readonly status: 'needs-reconfirmation';
}

function sameBooking(a: Booking, b: Booking): boolean {
  return a.taskId === b.taskId && a.amountInr === b.amountInr && a.capacity === b.capacity;
}

function capExceeded(version: PlanVersion, quoteId: QuoteSlot): boolean {
  for (const comparison of version.comparisons) {
    for (const row of comparison.rows) {
      if (row.key !== 'comparableTotal') continue;
      if (row.cells.some((cell) => cell.quoteId === quoteId && cell.status === 'cap-exceeded')) {
        return true;
      }
    }
  }
  return false;
}

function bookingReasons(
  booking: Booking,
  before: PlanVersion,
  after: PlanVersion,
): ReconfirmReason[] {
  const reasons: ReconfirmReason[] = [];
  if (before.headline.eventDate !== after.headline.eventDate) reasons.push('date');
  const guestsChanged = before.headline.guests !== after.headline.guests;
  const { capacity } = after.headline.venue;
  const overCapacity =
    booking.category === 'venue' && capacity !== null && after.headline.guests > capacity;
  // The capacity question already names the new guest count, so the venue is not asked twice.
  if (guestsChanged && overCapacity) reasons.push('capacity');
  const share = after.money.input.split.lines[booking.category].perGuestSharePercent;
  if (guestsChanged && !overCapacity && share > 0) reasons.push('guests');
  return reasons;
}

function quoteReasons(
  quoteId: QuoteSlot,
  before: PlanVersion,
  after: PlanVersion,
): ReconfirmReason[] {
  const quote = after.quotes.find((candidate) => candidate.id === quoteId);
  if (quote === undefined) return [];
  const reasons: ReconfirmReason[] = [];
  if (before.headline.eventDate !== after.headline.eventDate) reasons.push('date');
  const guestsChanged = before.headline.guests !== after.headline.guests;
  // A lump sum within its cap is a fixed price for the guests it names; a per-plate one is not.
  if (guestsChanged && quote.basis === 'perPlate') reasons.push('guests');
  if (capExceeded(after, quoteId) && !capExceeded(before, quoteId)) reasons.push('cap-exceeded');
  return reasons;
}

/** The vendors from `before` that the change since then asks to confirm again, in data order. */
export function reconfirmations(
  before: PlanVersion,
  after: PlanVersion,
): readonly ReconfirmationItem[] {
  const items: ReconfirmationItem[] = [];
  for (const booking of before.bookings) {
    const still = after.bookings.find((candidate) => candidate.category === booking.category);
    // Booked again since the change: the family confirmed the new terms themselves.
    if (still === undefined || !sameBooking(booking, still)) continue;
    const reasons = bookingReasons(booking, before, after);
    if (reasons.length > 0) {
      items.push({
        vendor: { kind: 'booking', category: booking.category, taskId: booking.taskId },
        reasons,
        status: 'needs-reconfirmation',
      });
    }
  }
  for (const quote of before.quotes) {
    const reasons = quoteReasons(quote.id, before, after);
    if (reasons.length > 0) {
      items.push({
        vendor: { kind: 'quote', category: quote.category, quoteId: quote.id },
        reasons,
        status: 'needs-reconfirmation',
      });
    }
  }
  return items;
}

export function sameVendor(a: VendorRef, b: VendorRef): boolean {
  if (a.kind === 'booking' && b.kind === 'booking') return a.category === b.category;
  if (a.kind === 'quote' && b.kind === 'quote') return a.quoteId === b.quoteId;
  return false;
}
