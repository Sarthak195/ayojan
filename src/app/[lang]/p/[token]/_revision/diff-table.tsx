import type { ReactElement } from 'react';

import { ScrollTable } from '@/components/table/scroll-table';
import type { Revision } from '@/core/plan/plan-view';
import { dictionaryFor } from '@/i18n/dictionary';

import { diffCells } from './diff-cells';
import type { Names } from './names';

/**
 * The revision diff (FR-25, D32): headline, money, quote ranking, venue fit and tasks, one row
 * per changed value with the cause beside it. A real table in a focusable scroll region, so a
 * narrow screen keeps its row and column headers (D35).
 */
export function DiffTable({
  revision,
  names,
}: {
  readonly revision: Revision;
  readonly names: Names;
}): ReactElement {
  const words = dictionaryFor(names.lang).revision;
  const head = 'border-b border-line bg-surface px-3 py-2 font-semibold';
  const cell = 'border-b border-line px-3 py-2 align-top';
  return (
    <ScrollTable
      id="diff-table"
      lang={names.lang}
      caption={words.diffCaption(revision.beforeVersion, revision.afterVersion)}
      captionNote={words.diffNote}
    >
      <thead>
        <tr>
          <th scope="col" className={head}>
            {words.whatColumn}
          </th>
          <th scope="col" className={head}>
            {words.beforeColumn}
          </th>
          <th scope="col" className={head}>
            {words.nowColumn}
          </th>
          <th scope="col" className={head}>
            {words.whyColumn}
          </th>
        </tr>
      </thead>
      <tbody>
        {revision.rows.map((row) => {
          const cells = diffCells(row, names);
          return (
            <tr key={cells.key}>
              <th scope="row" className={`${cell} font-medium`}>
                {cells.what}
              </th>
              <td className={cell}>{cells.before}</td>
              <td className={cell}>{cells.now}</td>
              <td className={cell}>{cells.why}</td>
            </tr>
          );
        })}
      </tbody>
    </ScrollTable>
  );
}
