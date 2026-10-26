import { z } from 'zod';

import { Category, Occasion, Priority } from '../readings/vocabulary';
import { Percent, planningRow } from './planning-row';

// Proportions only: every amount the app shows is a share of the user's own budget, so no
// rupee figure originates in this file.

const Floor = z.strictObject({
  // Move money may take a category down to this share of its own frozen allocation, or, for
  // contingency, of the whole budget.
  of: z.enum(['allocation', 'budget']),
  percent: Percent.min(1),
});

const CategoryWeight = z.strictObject({
  category: Category,
  ...planningRow,
  baseWeight: z.number().int().min(1).max(100),
  // How much of the category grows with the guest count: 100 scales fully, 0 not at all.
  perGuestSharePercent: Percent,
  floor: Floor,
});

const Profile = z.strictObject({
  id: z.enum(['wedding', 'celebration']),
  ...planningRow,
  // The occasions that use this profile; each occasion belongs to exactly one profile (D38).
  occasions: z.array(Occasion).min(1),
  categories: z.array(CategoryWeight).min(1),
});

const Multiplier = z.strictObject({
  priority: Priority,
  ...planningRow,
  percent: z.number().int().min(1).max(300),
});

export const BudgetWeightsFile = z.strictObject({
  multipliers: z.array(Multiplier).min(1),
  profiles: z.array(Profile).min(1),
});
export type BudgetWeightsFile = z.infer<typeof BudgetWeightsFile>;
