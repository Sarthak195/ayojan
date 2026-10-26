import type { PlanVersion } from '@/core/plan/plan-version';
import { quoteLabel } from '@/core/quotes/quote-wording';
import type { Lang } from '@/i18n/lang';
import type { DataDocuments } from '@/schemas/data/data-files';

import { categoryLabels, type CategoryLabel } from '../_change/category-labels';

/** Display names for the ids a diff row or a decision carries, in the page's language. */
export interface Names {
  readonly lang: Lang;
  readonly category: CategoryLabel;
  task(id: string): string;
  lever(id: string): string;
  /** "Caterer A" for a quote slot; the slot alone if no quote holds it any more. */
  quote(slot: string): string;
}

export function namesFor(current: PlanVersion, data: DataDocuments, lang: Lang): Names {
  return {
    lang,
    category: categoryLabels(data.budgetWeights, current.profile, lang),
    task: (id) => data.tasks.tasks.find((row) => row.id === id)?.[lang] ?? id,
    lever: (id) => data.levers.levers.find((row) => row.id === id)?.[lang] ?? id,
    quote: (slot) => {
      const quote = current.quotes.find((candidate) => candidate.id === slot);
      return quote === undefined ? slot : quoteLabel(quote, lang);
    },
  };
}
