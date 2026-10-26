import type { ReactElement } from 'react';

import type { Money } from '@/core/money/money';
import { formatRupees, formatRupeeWords } from '@/core/rupees/format';
import type { Lang } from '@/i18n/lang';

import { ProvenanceBadge, type ProvenanceDetail } from './provenance-badge';

export interface AmountProps extends ProvenanceDetail {
  /** A Money, not a number: an amount without a provenance cannot reach the page (spec 7). */
  readonly money: Money;
  readonly lang: Lang;
  /** Off only where the label already sits in the same row, such as a table column header. */
  readonly label?: boolean;
}

/**
 * "Rs 7,50,000 (7.5 lakh) Your split (planning assumption)": the exact figure in hand-written
 * Indian grouping (D30), the lakh or crore words as a reading aid, then the provenance label.
 */
export function Amount({ money, lang, vendor, percent, label = true }: AmountProps): ReactElement {
  const words = formatRupeeWords(money.inr, lang);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="font-semibold tabular-nums">{formatRupees(money.inr)}</span>
      {words === null ? null : <span className="text-sm text-muted">({words})</span>}
      {label ? (
        <ProvenanceBadge
          provenance={money.provenance}
          lang={lang}
          vendor={vendor}
          percent={percent}
        />
      ) : null}
    </span>
  );
}
