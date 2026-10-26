// A vendor the plan deals with. Vendors have no names in the app: a booked vendor is its
// category (and the task that booked it), a quoted one is its category and slot.

import type { QuoteSlot } from '@/schemas/plan/quote-record';
import type { Category } from '@/schemas/readings/vocabulary';

export type VendorRef =
  | { readonly kind: 'booking'; readonly category: Category; readonly taskId: string }
  | { readonly kind: 'quote'; readonly category: Category; readonly quoteId: QuoteSlot };

export function sameVendor(a: VendorRef, b: VendorRef): boolean {
  if (a.kind === 'booking' && b.kind === 'booking') return a.category === b.category;
  if (a.kind === 'quote' && b.kind === 'quote') return a.quoteId === b.quoteId;
  return false;
}
