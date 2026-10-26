import { join } from 'node:path';

import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';
import type { Category, Occasion, Priority } from '@/schemas/readings/vocabulary';
import { createKnowledgeRepository, readFromDirectory } from '@/server/knowledge/repository';

import type { AllocationInput } from '@/core/budget/allocation';
import { allocateBudget } from '@/core/budget/allocation';
import type { FrozenSplit } from '@/core/budget/frozen-split';

// The real draft data, so a table test that reads a weight breaks when the data changes
// instead of silently pinning a stale copy.
const documents = createKnowledgeRepository(readFromDirectory(join(process.cwd(), 'data'))).all();
export const budgetWeights: BudgetWeightsFile = documents.budgetWeights;
export const taskRows = documents.tasks.tasks;

export const CATEGORIES: readonly Category[] = [
  'venue',
  'catering',
  'decor',
  'photo',
  'music',
  'invites',
  'contingency',
];

export function priorities(
  changes: Partial<Record<Category, Priority>> = {},
  base: Priority = 'standard',
): Record<Category, Priority> {
  return {
    venue: base,
    catering: base,
    decor: base,
    photo: base,
    music: base,
    invites: base,
    contingency: base,
    ...changes,
  };
}

// The spec's worked example: 8 lakh, food invest-more, decor save, the rest standard.
export const DEMO_PRIORITIES = priorities({ catering: 'more', decor: 'save' });

export function allocationInput(overrides: Partial<AllocationInput> = {}): AllocationInput {
  return {
    occasion: 'wedding',
    budgetInr: 800_000,
    guests: 200,
    priorities: DEMO_PRIORITIES,
    ...overrides,
  };
}

export function splitFor(overrides: Partial<AllocationInput> = {}): FrozenSplit {
  const result = allocateBudget(allocationInput(overrides), budgetWeights);
  if (!result.ok) throw new Error(`The test split was refused: ${result.reason}`);
  return result.value;
}

export function amountsOf(split: FrozenSplit): Record<Category, number> {
  return {
    venue: split.lines.venue.allocation.inr,
    catering: split.lines.catering.allocation.inr,
    decor: split.lines.decor.allocation.inr,
    photo: split.lines.photo.allocation.inr,
    music: split.lines.music.allocation.inr,
    invites: split.lines.invites.allocation.inr,
    contingency: split.lines.contingency.allocation.inr,
  };
}

export const NAMED_OCCASIONS: readonly Occasion[] = [
  'wedding',
  'birthday',
  'anniversary',
  'puja',
  'communityEvent',
  'other',
];
