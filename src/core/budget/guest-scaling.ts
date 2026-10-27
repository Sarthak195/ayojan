// How a category's money follows the guest count (architecture 4.2, ADR 0003):
//   alloc + roundHalfUp(alloc x share x (guests_now - guests_at_split) / (100 x guests_at_split))
// `share` is the data's percent, so 100 grows the category fully with guests and 0 not at all.

import type { Money } from '../money/money';
import { scale } from '../money/money';
import { fail, fromMoney, succeed, type BudgetResult } from './budget-refusal';

export function scaledForGuests(
  allocationInr: number,
  perGuestSharePercent: number,
  guestsAtSplit: number,
  guestsNow: number,
): BudgetResult<Money> {
  if (!Number.isSafeInteger(guestsNow) || guestsNow < 1) return fail('guests-out-of-range');
  // g_alloc is the divisor, so a zero here would be a corrupt split, not a user's input.
  if (!Number.isSafeInteger(guestsAtSplit) || guestsAtSplit < 1) return fail('guests-out-of-range');
  if (!Number.isSafeInteger(allocationInr) || allocationInr < 0) return fail('amount-invalid');
  // The shift is the allocation times a small ratio; scale() multiplies in BigInt, so a very
  // large budget and guest count still divide exactly instead of passing 2^53.
  const shift = scale(
    { inr: allocationInr, provenance: 'your-split' },
    perGuestSharePercent * (guestsNow - guestsAtSplit),
    100 * guestsAtSplit,
  );
  if (!shift.ok) return fromMoney(shift);
  const projected = allocationInr + shift.value.inr;
  return Number.isSafeInteger(projected)
    ? succeed({ inr: projected, provenance: 'your-split' })
    : fail('out-of-range');
}
