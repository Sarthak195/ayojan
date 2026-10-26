import type { ReactElement } from 'react';

import type { LedgerRow } from '@/core/plan/ledger';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

const SHOWN = 5;

/** The newest steps first, each with the family's own words where a change carried them. */
export function LedgerSection({
  ledger,
  lang,
}: {
  readonly ledger: readonly LedgerRow[];
  readonly lang: Lang;
}): ReactElement {
  const words = dictionaryFor(lang).plan;
  return (
    <section id="ledger" aria-labelledby="ledger-heading" className="mt-8">
      <h2 id="ledger-heading" className="text-xl font-semibold">
        {words.ledgerHeading}
      </h2>
      <ol className="mt-2 space-y-2">
        {ledger.slice(0, SHOWN).map((row) => (
          <li key={row.version}>
            <span className="font-semibold">v{row.version}</span> {row[lang]}
            {row.sources.map((source) => (
              <q key={source} className="ml-2 text-muted">
                {source}
              </q>
            ))}
          </li>
        ))}
      </ol>
    </section>
  );
}
