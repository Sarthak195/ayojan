import type { ReactElement } from 'react';

import { Amount } from '@/components/money/amount';
import { Icon } from '@/components/status/icon';
import type { Money } from '@/core/money/money';
import type {
  ChargesCell,
  ClarificationCell,
  ComparisonRow,
  GuestsCoveredCell,
} from '@/core/quotes/comparison';
import type { ComparableTotal } from '@/core/quotes/quote-types';
import { groupIndian } from '@/core/rupees/format';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

// One cell of the comparison per row kind, worded from structured facts in the page's
// language. A figure from a quote names its vendor; a gap against the split is Computed; a
// warning always pairs its icon with words, so colour is never the only signal.

type Words = ReturnType<typeof dictionaryFor>['quotes'];

const count = (value: number): string => groupIndian(value);
// Basis points back to a percent for reading: 1800 is "18", 1250 is "12.5".
const percentOf = (basisPoints: number): string => String(basisPoints / 100);

function Included({ items, words }: { items: readonly string[]; words: Words }): ReactElement {
  if (items.length === 0) return <>{words.nothingListed}</>;
  return (
    <ul className="list-disc pl-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function covered(cell: GuestsCoveredCell, words: Words): string {
  switch (cell.kind) {
    case 'per-plate':
      return cell.minimumPlates === null || cell.minimumPlates === 0
        ? words.perPlateNoMinimum
        : words.perPlateMinimum(count(cell.minimumPlates));
    case 'up-to':
      return words.upTo(count(cell.guests));
    case 'not-stated':
      return words.notStated;
    case 'unknown':
      return words.notClear;
  }
}

function Charges(props: { cell: ChargesCell; vendor: string; lang: Lang }): ReactElement {
  const { cell, vendor, lang } = props;
  const words = dictionaryFor(lang).quotes;
  const tax =
    cell.tax === 'added' && cell.taxBasisPoints !== null
      ? words.taxAdded(percentOf(cell.taxBasisPoints))
      : words.taxCell[cell.tax === 'added' ? 'unclear' : cell.tax];
  return (
    <ul className="space-y-1">
      <li>{tax}</li>
      {cell.extras.map((extra, index) => (
        <li key={`${extra.key}-${String(index)}`}>
          {extra.key === 'liveCounter' ? words.liveCounter : extra.label}:{' '}
          {extra.amount === null ? (
            words.notStated
          ) : (
            <Amount money={extra.amount} lang={lang} vendor={vendor} />
          )}{' '}
          <span className="text-sm">({extra.counted ? words.counted : words.notCounted})</span>
        </li>
      ))}
      {cell.advancePercent === null ? null : <li>{words.advance(String(cell.advancePercent))}</li>}
    </ul>
  );
}

function CapExceeded({ words }: { words: Words }): ReactElement {
  return (
    <span className="inline-flex items-center gap-1 font-semibold">
      <Icon name="octagon" />
      <span>{words.capExceeded}</span>
    </span>
  );
}

function Clarify({ cell, words }: { cell: ClarificationCell; words: Words }): ReactElement {
  if (cell.gaps.length === 0 && cell.capExceededAt === null) return <>{words.nothingToClarify}</>;
  return (
    <ul className="space-y-1">
      {cell.capExceededAt === null ? null : (
        <li>
          <CapExceeded words={words} />
        </li>
      )}
      {cell.gaps.map((gap) => (
        <li key={gap} className="inline-flex items-center gap-1">
          <Icon name="circle" />
          <span>{words.gaps[gap]}</span>
        </li>
      ))}
    </ul>
  );
}

function Total(props: { total: ComparableTotal; vendor: string; lang: Lang }): ReactElement {
  const { total, vendor, lang } = props;
  const words = dictionaryFor(lang).quotes;
  if (total.status === 'cap-exceeded') return <CapExceeded words={words} />;
  if (total.status === 'unclear') {
    return (
      <span className="inline-flex items-center gap-1">
        <Icon name="circle" />
        <span>{words.notComparable}</span>
      </span>
    );
  }
  return (
    <span className="block space-y-1">
      <Amount money={total.total} lang={lang} vendor={vendor} />
      {total.tax.amount === null ? null : (
        <span className="block text-sm">
          {words.includesTax} <Amount money={total.tax.amount} lang={lang} vendor={vendor} />
        </span>
      )}
      {total.plusGstRateNotStated ? (
        <span className="flex items-center gap-1 text-sm font-medium">
          <Icon name="triangle" />
          <span>{words.plusGst}</span>
        </span>
      ) : null}
    </span>
  );
}

function AgainstSplit({ gap, lang }: { gap: Money | null; lang: Lang }): ReactElement {
  const words = dictionaryFor(lang).quotes;
  if (gap === null) return <>{words.notComparable}</>;
  if (gap.inr === 0) return <>{words.atSplit}</>;
  // Shown as a size and a direction, so a minus sign is never the only cue.
  const size: Money = { inr: Math.abs(gap.inr), provenance: gap.provenance };
  return (
    <span className="block">
      <Amount money={size} lang={lang} />{' '}
      <span className="font-medium">{gap.inr > 0 ? words.aboveSplit : words.belowSplit}</span>
    </span>
  );
}

/** The cell at column `index` of one comparison row. */
export function ComparisonCell({
  row,
  index,
  vendor,
  lang,
}: {
  readonly row: ComparisonRow;
  readonly index: number;
  readonly vendor: string;
  readonly lang: Lang;
}): ReactElement | null {
  const words = dictionaryFor(lang).quotes;
  switch (row.key) {
    case 'included': {
      const items = row.cells[index];
      return items === undefined ? null : <Included items={items} words={words} />;
    }
    case 'guestsCovered': {
      const cell = row.cells[index];
      return cell === undefined ? null : <>{covered(cell, words)}</>;
    }
    case 'additionalCharges': {
      const cell = row.cells[index];
      return cell === undefined ? null : <Charges cell={cell} vendor={vendor} lang={lang} />;
    }
    case 'needsClarification': {
      const cell = row.cells[index];
      return cell === undefined ? null : <Clarify cell={cell} words={words} />;
    }
    case 'comparableTotal': {
      const cell = row.cells[index];
      return cell === undefined ? null : <Total total={cell} vendor={vendor} lang={lang} />;
    }
    case 'againstSplit': {
      const cell = row.cells[index];
      return cell === undefined ? null : <AgainstSplit gap={cell} lang={lang} />;
    }
  }
}
