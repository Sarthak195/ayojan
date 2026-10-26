import type { ReactElement, ReactNode } from 'react';

import { Amount } from '@/components/money/amount';
import { StatusWord } from '@/components/status/status-word';
import type { Money } from '@/core/money/money';
import type { DiffRow, ReasonCode } from '@/core/plan/diff';
import { quoteLabel } from '@/core/quotes/quote-wording';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { countWords, dateWords } from '../../../_brief/words';
import type { Names } from './names';

export interface DiffCells {
  readonly key: string;
  readonly what: ReactNode;
  readonly before: ReactNode;
  readonly now: ReactNode;
  readonly why: string;
}

// The prefixed codes carry an id after the colon (FR-25); the page names it, never the id.
function reasonText(reason: ReasonCode, row: DiffRow, names: Names): string {
  const words = dictionaryFor(names.lang).revision.reason;
  const [code = '', id = ''] = reason.split(':');
  switch (code) {
    case 'guests-changed':
      return words.guestsChanged(row.kind === 'money' ? row.perGuestSharePercent : 0);
    case 'budget-changed':
      return words.budgetChanged;
    case 'event-date-moved':
      return words.eventDateMoved;
    case 'reallocated':
      return words.reallocated;
    case 'ranking-flipped': {
      const at = row.kind === 'ranking' ? row.crossedAtGuests : null;
      return words.rankingFlipped(at === null ? '' : countWords(at));
    }
    case 'task-delayed':
      return words.taskDelayed(names.task(id));
    case 'lever-applied':
      return words.leverApplied(names.lever(id));
    case 'task-done':
      return words.taskDone(names.task(id));
    default:
      return words.quoteAdded(names.quote(id));
  }
}

function GapCell({ gap, lang }: { readonly gap: Money; readonly lang: Lang }): ReactElement {
  const words = dictionaryFor(lang).revision;
  const over = gap.inr > 0;
  return (
    <>
      {over ? words.over : words.under}{' '}
      <Amount money={{ inr: Math.abs(gap.inr), provenance: gap.provenance }} lang={lang} />
    </>
  );
}

type Facts = Extract<DiffRow, { kind: 'task' }>['before'];

function TaskCell({ facts, lang }: { readonly facts: Facts; readonly lang: Lang }): ReactElement {
  return (
    <>
      <StatusWord status={facts.status} lang={lang} />{' '}
      <span>{dictionaryFor(lang).plan.slack(facts.slackDays)}</span>
    </>
  );
}

function MoveCell({
  row,
  names,
}: {
  readonly row: Extract<DiffRow, { kind: 'reallocation' }>;
  readonly names: Names;
}): ReactElement {
  const { lang } = names;
  const words = dictionaryFor(lang).revision;
  const { outcome } = row;
  return (
    <ul className="space-y-1">
      {outcome.fromHeadroom.inr > 0 ? (
        <li>
          <Amount money={outcome.fromHeadroom} lang={lang} /> {words.fromHeadroom}
        </li>
      ) : null}
      {outcome.givers.map((giver) => (
        <li key={giver.category}>
          <Amount money={giver.amount} lang={lang} />{' '}
          {words.fromGiver(names.category(giver.category))}
        </li>
      ))}
      {outcome.shortfall.inr > 0 ? (
        <li>
          <Amount money={outcome.shortfall} lang={lang} /> {words.shortfall}
        </li>
      ) : null}
    </ul>
  );
}

/** One diff row as the four cells of the table: what, before, now and why. */
export function diffCells(row: DiffRow, names: Names): DiffCells {
  const { lang } = names;
  const words = dictionaryFor(lang).revision;
  const why = reasonText(row.reason, row, names);
  switch (row.kind) {
    case 'guests':
      return {
        key: 'guests',
        what: words.guests,
        before: countWords(row.before),
        now: countWords(row.after),
        why,
      };
    case 'budget':
    case 'projected':
      return {
        key: row.kind,
        what: row.kind === 'budget' ? words.budget : words.projected,
        before: <Amount money={row.before} lang={lang} />,
        now: <Amount money={row.after} lang={lang} />,
        why,
      };
    case 'eventDate':
      return {
        key: 'eventDate',
        what: words.date,
        before: dateWords(row.before, lang),
        now: dateWords(row.after, lang),
        why,
      };
    case 'gap':
      return {
        key: 'gap',
        what: words.gap,
        before: <GapCell gap={row.before} lang={lang} />,
        now: <GapCell gap={row.after} lang={lang} />,
        why,
      };
    case 'money':
      return {
        key: `money-${row.category}`,
        what: names.category(row.category),
        before: <Amount money={row.before.projected} lang={lang} />,
        now: <Amount money={row.after.projected} lang={lang} />,
        why,
      };
    case 'reallocation':
      return {
        key: `move-${String(row.opIndex)}`,
        what: words.movedTo(names.category(row.outcome.target)),
        before: '',
        now: <MoveCell row={row} names={names} />,
        why,
      };
    case 'ranking': {
      const cheaper = (slot: typeof row.before): string =>
        slot === null
          ? words.noQuote
          : words.cheaper(quoteLabel({ category: row.category, id: slot }, lang));
      return {
        key: `ranking-${row.category}`,
        what: words.cheapestIn(names.category(row.category)),
        before: cheaper(row.before),
        now: cheaper(row.after),
        why,
      };
    }
    case 'venueFit': {
      const fit = (guests: number): string =>
        guests <= row.capacity
          ? words.fits(guests, row.capacity)
          : words.overCapacity(guests, row.capacity);
      return {
        key: 'venueFit',
        what: words.venueFit,
        before: fit(row.before),
        now: fit(row.after),
        why,
      };
    }
    case 'task':
      return {
        key: `task-${row.taskId}`,
        what: row.name[lang],
        before: <TaskCell facts={row.before} lang={lang} />,
        now: <TaskCell facts={row.after} lang={lang} />,
        why,
      };
  }
}
