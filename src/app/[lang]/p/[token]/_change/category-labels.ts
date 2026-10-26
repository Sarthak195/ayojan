import type { Lang } from '@/i18n/lang';
import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';
import type { Category } from '@/schemas/readings/vocabulary';

export type CategoryLabel = (category: Category) => string;

/**
 * Category names as the plan's profile words them, so a birthday never reads "Music and
 * baraat" (D15). A category the profile does not list keeps its id, which never happens with
 * valid data but keeps the page from rendering a blank.
 */
export function categoryLabels(
  weights: BudgetWeightsFile,
  profileId: string,
  lang: Lang,
): CategoryLabel {
  const profile = weights.profiles.find((row) => row.id === profileId);
  return (category) =>
    profile?.categories.find((row) => row.category === category)?.[lang] ?? category;
}
