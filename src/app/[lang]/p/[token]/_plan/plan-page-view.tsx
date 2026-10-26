import type { ReactElement } from 'react';

import { PlanBanners } from '@/components/banner/banners';
import { StatusSummary } from '@/components/layout/status-summary';
import type { LedgerRow } from '@/core/plan/ledger';
import type { PlanView } from '@/core/plan/plan-view';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';

import { dateWords } from '../../../_brief/words';
import { Headline } from './headline';
import { LedgerSection } from './ledger-section';
import { MoneySection } from './money-section';
import { movedSummary, TasksSection } from './tasks-section';

export interface PlanPageViewProps {
  readonly lang: Lang;
  readonly token: string;
  readonly view: PlanView;
  readonly weights: BudgetWeightsFile;
  /** The task the latest op delayed, so the status line can name the dependants it moved. */
  readonly latestDelay?: string | null;
}

// How the latest version was made (spec 7, FR-41): read by AI with its count, an example
// reading, or entered by form. Steps that read nothing (a booking) carry no such line.
function readLine(row: LedgerRow | undefined, lang: Lang): string | null {
  const readBy = row?.readBy;
  if (readBy === undefined || readBy === null) return null;
  const words = dictionaryFor(lang).plan;
  if (readBy.source === 'form') return words.enteredByForm;
  return readBy.source === 'example'
    ? words.readByExample(readBy.matched, readBy.total)
    : words.readByAi(readBy.matched, readBy.total);
}

const SECTIONS = ['money', 'tasks', 'ledger', 'next'] as const;

/** The plan (spec 6.4): everything on it is derived from the ops in the link. */
export function PlanPageView({
  lang,
  token,
  view,
  weights,
  latestDelay = null,
}: PlanPageViewProps): ReactElement {
  const dict = dictionaryFor(lang);
  const words = dict.plan;
  const { current } = view;
  const latest = view.ledger[0];
  const read = readLine(latest, lang);
  const base = `/${lang}/p/${token}`;
  const moved =
    latestDelay === null
      ? ''
      : ` ${movedSummary(current.schedule, current.delayEffects, latestDelay, lang)}`;
  const jump: Readonly<Record<(typeof SECTIONS)[number], string>> = {
    money: words.moneyHeading,
    tasks: words.tasksHeading,
    ledger: words.ledgerHeading,
    next: words.nextHeading,
  };
  return (
    <div>
      <h1 className="text-2xl font-bold">
        {words.title(
          current.version,
          dict.form.occasions[current.brief.occasion],
          dateWords(current.headline.eventDate, lang),
        )}
      </h1>
      {read === null ? null : <p className="mt-2">{read}</p>}
      <StatusSummary>
        {words.statusSummary(current.version, latest === undefined ? '' : latest[lang])}
        {moved}
      </StatusSummary>
      <p className="text-sm text-muted">{words.keepLink}</p>
      <PlanBanners banners={view.banners} lang={lang} />
      <nav aria-label={words.jumpTo} className="mt-4">
        <span className="font-medium">{words.jumpTo}:</span>{' '}
        {SECTIONS.map((section) => (
          <a key={section} href={`#${section}`} className="mr-3 inline-flex min-h-11 items-center">
            {jump[section]}
          </a>
        ))}
      </nav>
      <Headline headline={current.headline} lang={lang} />
      <MoneySection current={current} weights={weights} lang={lang} />
      <TasksSection
        schedule={current.schedule}
        delayEffects={current.delayEffects}
        lang={lang}
        token={token}
      />
      {current.brief.notes.length === 0 ? null : (
        <section aria-labelledby="noted-heading" className="mt-8">
          <h2 id="noted-heading" className="text-xl font-semibold">
            {words.notedHeading}
          </h2>
          <ul className="mt-2 list-disc pl-6">
            {current.brief.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
      <LedgerSection ledger={view.ledger} lang={lang} />
      <section id="next" aria-labelledby="next-heading" className="mt-8">
        <h2 id="next-heading" className="text-xl font-semibold">
          {words.nextHeading}
        </h2>
        <ul className="mt-2">
          <li>
            <a href={`${base}/quotes`} className="inline-flex min-h-11 items-center font-semibold">
              {words.quotesLink}
            </a>
          </li>
          <li>
            <a
              href={`${base}/revision`}
              className="inline-flex min-h-11 items-center font-semibold"
            >
              {words.changeLink}
            </a>
          </li>
          <li>
            <a
              href={`${base}/revision#levers`}
              className="inline-flex min-h-11 items-center font-semibold"
            >
              {words.leversLink}
            </a>
          </li>
          <li>
            <a
              href={`${base}/messages`}
              className="inline-flex min-h-11 items-center font-semibold"
            >
              {words.messagesLink}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
