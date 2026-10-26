import type { ReactElement } from 'react';

import type { Provenance } from '@/core/money/money';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

export interface ProvenanceDetail {
  /** For `from-quote`: the stored vendor label, e.g. "Caterer A" (never pasted text). */
  readonly vendor?: string | undefined;
  /** For `assumption`: the data row's percentage, e.g. 30 for "about 30 percent". */
  readonly percent?: number | undefined;
}

/** The label text for a provenance (spec 7), in the page's language. */
export function provenanceLabel(
  provenance: Provenance,
  lang: Lang,
  detail: ProvenanceDetail = {},
): string {
  const words = dictionaryFor(lang).common.provenance;
  switch (provenance) {
    case 'your-number':
      return words.yourNumber;
    case 'your-split':
      return words.yourSplit;
    case 'from-quote':
      return detail.vendor === undefined ? words.fromAQuote : words.fromQuote(detail.vendor);
    case 'computed':
      return words.computed;
    case 'assumption':
      return detail.percent === undefined
        ? words.assumption
        : words.assumptionPercent(detail.percent);
  }
}

/** Where a figure came from, as visible text: never colour or an icon alone. */
export function ProvenanceBadge({
  provenance,
  lang,
  vendor,
  percent,
}: { readonly provenance: Provenance; readonly lang: Lang } & ProvenanceDetail): ReactElement {
  return (
    <span className="inline-block rounded border border-line px-1.5 text-xs leading-5 text-muted">
      {provenanceLabel(provenance, lang, { vendor, percent })}
    </span>
  );
}
