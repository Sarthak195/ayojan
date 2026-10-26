import type { ReactElement, ReactNode } from 'react';

import { Amount } from '@/components/money/amount';
import { Icon, type IconName } from '@/components/status/icon';
import { budgetAfter, guestsAfter, type CurrentHeadline } from '@/core/plan/change-questions';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { FieldVerdict } from '@/schemas/plan/state-token';

import { dateWords } from '../../../_brief/words';
import type { CategoryLabel } from './category-labels';
import type { PendingChange } from './change-values';

const STATUS_ICON: Readonly<Record<FieldVerdict['status'], IconName>> = {
  verified: 'check',
  unverified: 'triangle',
  unclear: 'circle',
  absent: 'info',
};

type VerdictField = 'guests' | 'budget' | 'dateShift' | 'dateWritten' | 'reallocate';
const FIELDS: readonly VerdictField[] = [
  'guests',
  'budget',
  'dateShift',
  'dateWritten',
  'reallocate',
];

interface Row {
  readonly field: VerdictField;
  readonly value: ReactNode;
}

function verdictOf(pending: PendingChange, field: VerdictField): FieldVerdict | undefined {
  return pending.fields.find((verdict) => verdict.field === field);
}

// Which reading field a date candidate came from. read-change lists the shifted date first and
// the written one second; with one candidate, the verified verdict names its source.
function dateFields(pending: PendingChange): VerdictField[] {
  const { dateCandidates } = pending.values;
  if (dateCandidates.length > 1) return ['dateShift', 'dateWritten'];
  const written = verdictOf(pending, 'dateWritten')?.status === 'verified';
  const shifted = verdictOf(pending, 'dateShift')?.status === 'verified';
  return [written && !shifted ? 'dateWritten' : 'dateShift'];
}

function rowsOf(
  pending: PendingChange,
  current: CurrentHeadline,
  labelOf: CategoryLabel,
  lang: Lang,
): Row[] {
  const words = dictionaryFor(lang).change;
  const { values } = pending;
  const rows: Row[] = [];
  const { guests, budget, reallocate } = values;
  if (guests !== null) {
    const total = guestsAfter(values, current) ?? guests.count;
    const value =
      guests.mode === 'delta' ? words.guestsDelta(guests.count, total) : words.guestsTotal(total);
    rows.push({ field: 'guests', value });
  }
  if (budget !== null) {
    const after = budgetAfter(values, current);
    const value =
      budget.mode === 'absolute' && budget.amountInr !== null ? (
        <Amount money={{ inr: budget.amountInr, provenance: 'your-number' }} lang={lang} />
      ) : after === null ? (
        <>
          {words.direction[budget.direction]}, {words.amountNotGiven}
        </>
      ) : (
        <>
          {words.direction[budget.direction]}:{' '}
          <Amount money={{ inr: after, provenance: 'computed' }} lang={lang} />
        </>
      );
    rows.push({ field: 'budget', value });
  }
  const sources = dateFields(pending);
  values.dateCandidates.forEach((date, index) => {
    rows.push({ field: sources[index] ?? 'dateShift', value: words.dateTo(dateWords(date, lang)) });
  });
  if (reallocate !== null) {
    const { to, amountInr } = reallocate;
    const value =
      to === null || amountInr === null ? (
        words.moveUnknown
      ) : (
        <>
          <Amount money={{ inr: amountInr, provenance: 'your-number' }} lang={lang} />{' '}
          {words.moveTo(labelOf(to))}
        </>
      );
    rows.push({ field: 'reallocate', value });
  }
  // A claim the reader made but code could not verify has no value; it is still shown (FR-2).
  for (const field of FIELDS) {
    const verdict = verdictOf(pending, field);
    const shown = rows.some((row) => row.field === field);
    if (!shown && verdict !== undefined && verdict.status !== 'absent') {
      rows.push({ field, value: null });
    }
  }
  return rows;
}

/** Every value of the change beside the user's words and whether code found them (FR-2). */
export function ChangeReadingList({
  pending,
  current,
  labelOf,
  lang,
}: {
  readonly pending: PendingChange;
  readonly current: CurrentHeadline;
  readonly labelOf: CategoryLabel;
  readonly lang: Lang;
}): ReactElement {
  const dict = dictionaryFor(lang);
  const words = dict.change;
  const form = pending.readBy.source === 'form';
  return (
    <ul className="mt-2 divide-y divide-line">
      {rowsOf(pending, current, labelOf, lang).map((row, index) => {
        const verdict = form ? undefined : verdictOf(pending, row.field);
        const label =
          form && (row.field === 'dateShift' || row.field === 'dateWritten')
            ? words.dateLabel
            : words.fields[row.field];
        return (
          <li key={`${row.field}-${String(index)}`} className="py-3">
            <p>
              <span className="font-medium">{label}</span>
              {row.value === null ? null : <>: {row.value}</>}
            </p>
            {verdict === undefined || verdict.displayQuote === null ? null : (
              <p className="mt-1">
                <mark className="rounded bg-note-bg px-1 text-foreground">
                  <q>{verdict.displayQuote}</q>
                </mark>
              </p>
            )}
            {verdict === undefined ? null : (
              <p className="mt-1 inline-flex items-center gap-1 text-sm">
                <Icon name={STATUS_ICON[verdict.status]} />
                <span>{dict.check.status[verdict.status]}</span>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
