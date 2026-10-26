import type { ReactElement, ReactNode } from 'react';

import type { Money } from '@/core/money/money';
import type { Lang } from '@/i18n/lang';

import { Amount } from '../money/amount';
import type { ProvenanceDetail } from '../money/provenance-badge';
import { ScrollTable } from './scroll-table';

/** A cell is a labelled amount, or text (a status word, a dash for "not booked"). */
export type MoneyCell =
  ({ readonly money: Money } & ProvenanceDetail) | { readonly text: ReactNode };

export interface MoneyTableRow {
  /** Stable React key, such as the category or vendor id. */
  readonly key: string;
  /** The row header (`<th scope="row">`), e.g. "Catering". */
  readonly header: ReactNode;
  readonly cells: readonly MoneyCell[];
}

export interface MoneyTableProps {
  readonly id: string;
  readonly lang: Lang;
  readonly caption: ReactNode;
  readonly captionNote?: ReactNode;
  /** Column headings, the first one heading the row-header column. */
  readonly columns: readonly string[];
  readonly rows: readonly MoneyTableRow[];
}

const CELL = 'border-t border-line px-3 py-2 align-top';

function Cell({ cell, lang }: { readonly cell: MoneyCell; readonly lang: Lang }): ReactElement {
  if ('text' in cell) return <td className={CELL}>{cell.text}</td>;
  return (
    <td className={CELL}>
      <Amount money={cell.money} lang={lang} vendor={cell.vendor} percent={cell.percent} />
    </td>
  );
}

/** Rupee figures in a scrollable table; every amount carries its provenance label in its cell. */
export function MoneyTable({
  id,
  lang,
  caption,
  captionNote,
  columns,
  rows,
}: MoneyTableProps): ReactElement {
  return (
    <ScrollTable id={id} caption={caption} captionNote={captionNote}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col" className="bg-surface px-3 py-2 font-semibold">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row" className={`${CELL} font-medium`}>
              {row.header}
            </th>
            {row.cells.map((cell, index) => (
              <Cell key={`${row.key}-${String(index)}`} cell={cell} lang={lang} />
            ))}
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  );
}
