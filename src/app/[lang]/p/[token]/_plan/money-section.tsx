import type { ReactElement } from 'react';

import { DISCLOSURE_GROUP, DisclosureMarker, LINK_SUMMARY } from '@/components/layout/disclosure';
import type { MoneyTableRow } from '@/components/table/money-table';
import { MoneyTable } from '@/components/table/money-table';
import { sum } from '@/core/money/money';
import type { PlanVersion } from '@/core/plan/plan-version';
import { quoteLabel } from '@/core/quotes/quote-wording';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';

/**
 * The split of the user's own budget and the projected cost per category, every amount with
 * its provenance in its own cell (spec 7). Category names come from the plan's profile, so a
 * birthday never reads "Music and baraat" (D15).
 */
export function MoneySection({
  current,
  weights,
  lang,
}: {
  readonly current: PlanVersion;
  readonly weights: BudgetWeightsFile;
  readonly lang: Lang;
}): ReactElement {
  const words = dictionaryFor(lang).plan;
  const { projection, cheapest } = current.money;
  const profile = weights.profiles.find((row) => row.id === current.profile);
  const labelOf = (category: string): string =>
    profile?.categories.find((row) => row.category === category)?.[lang] ?? category;

  const rows: MoneyTableRow[] = projection.order.map((category) => {
    const line = projection.lines[category];
    const quoted = line.source === 'quote' ? cheapest[category] : undefined;
    const vendor =
      quoted === undefined ? undefined : quoteLabel({ category, id: quoted.quoteId }, lang);
    return {
      key: category,
      header: labelOf(category),
      cells: [{ money: line.allocation }, { money: line.projected, vendor }],
    };
  });
  const split = sum(projection.order.map((category) => projection.lines[category].allocation));
  rows.push({
    key: 'total',
    header: words.total,
    cells: [split.ok ? { money: split.value } : { text: '' }, { money: projection.projectedTotal }],
  });

  return (
    <section id="money" aria-labelledby="money-heading" className="mt-8">
      <h2 id="money-heading" className="text-xl font-semibold">
        {words.moneyHeading}
      </h2>
      <MoneyTable
        id="money-table"
        lang={lang}
        caption={words.moneyCaption}
        captionNote={words.moneyCaptionNote}
        columns={[words.categoryColumn, words.splitColumn, words.projectedColumn]}
        rows={rows}
      />
      {profile === undefined ? null : (
        <details className={`my-2 ${DISCLOSURE_GROUP}`}>
          <summary className={LINK_SUMMARY}>
            {words.whyHeading}
            <DisclosureMarker />
          </summary>
          {/* The basis is the author's stated assumption, written once in English (D37); the
              category keeps the page's own name, so it matches the table above. */}
          <ul lang="en" className="mt-2 list-disc space-y-1 pl-6 text-sm">
            <li>{profile.basis}</li>
            {profile.categories.map((row) => (
              <li key={row.category}>
                <span lang={lang} className="font-medium">
                  {row[lang]}
                </span>
                : {row.basis}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
