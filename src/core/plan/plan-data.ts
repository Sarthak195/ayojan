// The planning data a plan is folded against. The server loads it once per instance and passes
// it in, so the plan engines stay pure and a test can hand them the real files or a variant.

import type { DataDocuments } from '@/schemas/data/data-files';
import type { LeverId } from '@/schemas/generated/ids';

export type PlanData = Pick<
  DataDocuments,
  'budgetWeights' | 'tasks' | 'levers' | 'vendorQuestions'
>;

/** Distinct lever ids in the data's order, so the same choice always reads the same way. */
export function leversInDataOrder(data: PlanData, ids: readonly LeverId[]): LeverId[] {
  const position = (id: LeverId): number => data.levers.levers.findIndex((row) => row.id === id);
  return [...new Set(ids)].sort((a, b) => position(a) - position(b));
}
