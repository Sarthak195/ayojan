// Who may give money away when the user moves money to a category (D12). The rules are a
// list of reasons a category is NOT a giver, checked in a fixed order so the reason shown
// to the user is always the same one.

import type { Category, Priority } from '@/schemas/readings/vocabulary';

import type { Projection } from './projection';

export type GiverBlock = 'target' | 'invest-more' | 'must-have' | 'booked' | 'quoted' | 'levered';

export type GiverTier = 'save' | 'standard';

export interface GiverContext {
  readonly target: Category;
  readonly priorities: Readonly<Record<Category, Priority>>;
  readonly projection: Projection;
  /** Categories tied to a must-have the family named, e.g. music for the dhol. */
  readonly mustHaveCategories: readonly Category[];
}

/** Why this category may not give, or null when it may. */
export function giverBlock(context: GiverContext, category: Category): GiverBlock | null {
  if (category === context.target) return 'target';
  if (context.priorities[category] === 'more') return 'invest-more';
  if (context.mustHaveCategories.includes(category)) return 'must-have';
  const { held } = context.projection.lines[category];
  if (held.booked) return 'booked';
  if (held.quoted) return 'quoted';
  if (held.levered) return 'levered';
  return null;
}

/** An unanswered priority counts as standard, exactly as the weights treat it (D15). */
export function giverTier(priority: Priority): GiverTier {
  return priority === 'save' ? 'save' : 'standard';
}
