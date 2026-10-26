import type { ReactElement } from 'react';

import { Amount } from '@/components/money/amount';
import { ScrollTable } from '@/components/table/scroll-table';
import type { Money } from '@/core/money/money';
import type { Comparison } from '@/core/quotes/comparison';
import {
  breakEvenSentence,
  quoteLabel,
  rowHeading,
  UNCONFIRMED_UNTIL_BOOKED,
} from '@/core/quotes/quote-wording';
import { groupIndian } from '@/core/rupees/format';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { ComparisonCell } from './comparison-cells';

const CELL = 'border-t border-line px-3 py-2 align-top';

/**
 * One category's quotes side by side (spec 6.5, FR-18): the explainer's four headings, then
 * the comparable total at the current guests and the gap against the family's split. Every
 * column header says the quote is unconfirmed until booked, and the break-even line follows.
 */
export function ComparisonTable({
  comparison,
  categoryLabel,
  allocation,
  lang,
}: {
  readonly comparison: Comparison;
  readonly categoryLabel: string;
  readonly allocation: Money;
  readonly lang: Lang;
}): ReactElement {
  const words = dictionaryFor(lang).quotes;
  const { category, guests } = comparison;
  const label = (id: Comparison['columns'][number]['quoteId']): string =>
    quoteLabel({ category, id }, lang);
  const headingId = `compare-${category}`;
  const sentences = comparison.breakEvens.map((result) => breakEvenSentence(result, label, lang));
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className="text-xl font-semibold">
        {words.comparisonHeading(categoryLabel, groupIndian(guests))}
      </h2>
      <ScrollTable
        id={`${headingId}-table`}
        caption={words.comparisonHeading(categoryLabel, groupIndian(guests))}
        captionNote={
          <>
            {words.splitNote} <Amount money={allocation} lang={lang} />
          </>
        }
      >
        <thead>
          <tr>
            <th scope="col" className="bg-surface px-3 py-2 font-semibold">
              {words.vendorColumn}
            </th>
            {comparison.columns.map((column) => (
              <th key={column.quoteId} scope="col" className="bg-surface px-3 py-2 font-semibold">
                {label(column.quoteId)}
                <span className="block text-xs font-normal">{UNCONFIRMED_UNTIL_BOOKED[lang]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className={`${CELL} font-medium`}>
                {rowHeading(row.key, guests, lang)}
              </th>
              {comparison.columns.map((column, index) => (
                <td key={column.quoteId} className={CELL}>
                  <ComparisonCell
                    row={row}
                    index={index}
                    vendor={label(column.quoteId)}
                    lang={lang}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </ScrollTable>
      {sentences.map((sentence, index) =>
        sentence.headline === null && sentence.capNote === null ? null : (
          <p key={comparison.breakEvens[index]?.quotes.join('-') ?? index} className="mt-2">
            {sentence.headline === null ? null : (
              <span className="font-semibold">{sentence.headline}</span>
            )}{' '}
            {sentence.capNote}
          </p>
        ),
      )}
      <p className="mt-2 text-sm">{UNCONFIRMED_UNTIL_BOOKED[lang]}.</p>
    </section>
  );
}
