'use client';

import { useEffect, useState, type ReactElement } from 'react';

export interface RunningTotalProps {
  /** The lever form whose boxes this line follows. */
  readonly formId: string;
  /** Server-computed sentences keyed by the ticked lever ids in data order, joined by commas. */
  readonly table: Readonly<Record<string, string>>;
  /** Tickable lever ids in data order, so a key is built the same way the table was. */
  readonly order: readonly string[];
  /** Refused levers: they count only once their "Show anyway" box is ticked too. */
  readonly needsShowAnyway: readonly string[];
  /** The server's sentence for the boxes as rendered, so hydration matches. */
  readonly initial: string;
  readonly id: string;
}

function ticked(form: HTMLFormElement, name: string): Set<string> {
  const values = new FormData(form).getAll(name);
  return new Set(values.filter((value): value is string => typeof value === 'string'));
}

/**
 * Island 1 of 2 (arch 8): the running line under the lever boxes. Without JavaScript the same
 * paragraph shows the server's sentence and Recalculate refreshes it. With JavaScript it looks
 * up the sentence for the ticked boxes in a table the server computed; it adds nothing up, and
 * the server recomputes everything again on Apply. It changes text only, never motion.
 */
export function RunningTotal({
  formId,
  table,
  order,
  needsShowAnyway,
  initial,
  id,
}: RunningTotalProps): ReactElement {
  const [sentence, setSentence] = useState(initial);
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return undefined;
    const follow = (): void => {
      const levers = ticked(form, 'lever');
      const shown = ticked(form, 'showAnyway');
      const key = order
        .filter(
          (lever) => levers.has(lever) && (!needsShowAnyway.includes(lever) || shown.has(lever)),
        )
        .join(',');
      const found = table[key];
      if (found !== undefined) setSentence(found);
    };
    form.addEventListener('change', follow);
    return () => {
      form.removeEventListener('change', follow);
    };
  }, [formId, table, order, needsShowAnyway]);
  return (
    <p id={id} role="status" className="my-4 rounded bg-surface px-3 py-2 text-lg font-semibold">
      {sentence}
    </p>
  );
}
