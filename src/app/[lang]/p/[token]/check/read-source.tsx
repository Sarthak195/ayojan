import type { ReactElement } from 'react';

import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { ReadBy } from '@/schemas/plan/brief';

/**
 * How a reading was made, and by which model. The id is the one the server answered with,
 * never the one requested, because the API may serve a newer model under an older name.
 */
export function ReadSource({
  readBy,
  label,
  lang,
}: {
  readonly readBy: ReadBy;
  readonly label: string;
  readonly lang: Lang;
}): ReactElement {
  return (
    <>
      <p className="mt-4 font-medium">{label}</p>
      {readBy.source === 'form' || readBy.model === null ? null : (
        <p className="mt-1 text-sm text-muted">
          {dictionaryFor(lang).check.answeredBy(readBy.model)}
        </p>
      )}
    </>
  );
}
