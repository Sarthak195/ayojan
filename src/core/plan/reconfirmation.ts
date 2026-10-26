// Which vendors must confirm again (architecture 4.8, FR-27). Each booked or quoted vendor agreed
// to the guest count and date the plan had when it quoted or was booked; when a change has moved
// either since, the app does not assume the deal holds: it marks the vendor "Needs
// re-confirmation" and says what to ask. The mark stays until the vendor is booked again on the
// new terms, so a later change of something else does not make the question disappear.

import type { QuoteSlot } from '@/schemas/plan/quote-record';

import type { PlanVersion, VendorAgreement } from './plan-version';
import type { VendorRef } from './vendor-ref';

export { sameVendor, type VendorRef } from './vendor-ref';

export type ReconfirmReason = 'date' | 'guests' | 'capacity' | 'cap-exceeded';

export interface ReconfirmationItem {
  readonly vendor: VendorRef;
  readonly reasons: readonly ReconfirmReason[];
  readonly status: 'needs-reconfirmation';
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

function bookingReasons(agreed: VendorAgreement, version: PlanVersion): ReconfirmReason[] {
  const { headline } = version;
  const { category } = agreed.vendor;
  const reasons: ReconfirmReason[] = [];
  if (agreed.eventDate !== headline.eventDate) reasons.push('date');
  const guestsChanged = agreed.guests !== headline.guests;
  const { capacity } = headline.venue;
  const overCapacity = category === 'venue' && capacity !== null && headline.guests > capacity;
  // The capacity question already names the new guest count, so the venue is not asked twice.
  if (guestsChanged && overCapacity) reasons.push('capacity');
  const share = version.money.input.split.lines[category].perGuestSharePercent;
  if (guestsChanged && !overCapacity && share > 0) reasons.push('guests');
  return reasons;
}

function quoteReasons(
  agreed: VendorAgreement,
  quoteId: QuoteSlot,
  version: PlanVersion,
): ReconfirmReason[] {
  const quote = version.quotes.find((candidate) => candidate.id === quoteId);
  if (quote === undefined) return [];
  const reasons: ReconfirmReason[] = [];
  if (agreed.eventDate !== version.headline.eventDate) reasons.push('date');
  const guestsChanged = agreed.guests !== version.headline.guests;
  // A lump sum within its cap is a fixed price for the guests it names; a per-plate one is not.
  if (guestsChanged && quote.basis === 'perPlate') reasons.push('guests');
  if (guestsChanged && capExceeded(version, quoteId)) reasons.push('cap-exceeded');
  return reasons;
}

/** Every vendor whose agreed guests or date the plan has since moved away from, in data order. */
export function reconfirmations(version: PlanVersion): readonly ReconfirmationItem[] {
  const items: ReconfirmationItem[] = [];
  for (const agreed of version.agreements) {
    const { vendor } = agreed;
    const reasons =
      vendor.kind === 'booking'
        ? bookingReasons(agreed, version)
        : quoteReasons(agreed, vendor.quoteId, version);
    if (reasons.length > 0) items.push({ vendor, reasons, status: 'needs-reconfirmation' });
  }
  return items;
}
