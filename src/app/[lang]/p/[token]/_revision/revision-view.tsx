import type { ReactElement, ReactNode } from 'react';

import { StatusSummary } from '@/components/layout/status-summary';
import type { PlanView } from '@/core/plan/plan-view';
import { formatRupees } from '@/core/rupees/format';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { DataDocuments } from '@/schemas/data/data-files';

import { UndoForm } from '../_change/undo-form';
import { DiffTable } from './diff-table';
import { KeptLists } from './kept-list';
import { namesFor } from './names';
import { ReconfirmList } from './reconfirm-list';

export interface RevisionViewProps {
  readonly lang: Lang;
  readonly token: string;
  readonly view: PlanView;
  readonly data: DataDocuments;
  /** The trade-off section, which always works on the current plan (D32). */
  readonly levers?: ReactNode;
}

/**
 * The revision page (spec 6.6): the latest change against the version just before it (D32),
 * what was kept, who to ask again, and Undo. Everything is derived from the ops in the link.
 */
export function RevisionView({ lang, token, view, data, levers }: RevisionViewProps): ReactElement {
  const words = dictionaryFor(lang).revision;
  const { current, revision } = view;
  const names = namesFor(current, data, lang);
  const { gap } = current.headline;
  // Nothing rides in the 303, so the summary is composed from the plan itself (D35).
  const summary =
    revision === null
      ? words.statusNoChange(current.version)
      : gap.inr > 0
        ? words.statusOver(current.version, formatRupees(gap.inr))
        : words.statusWithin(current.version, formatRupees(-gap.inr));
  return (
    <div>
      <h1 className="text-2xl font-bold">
        {revision === null ? words.noChangeTitle : words.title(revision.afterVersion)}
      </h1>
      <StatusSummary>{summary}</StatusSummary>
      {revision === null ? (
        <p className="mt-2">{words.noChangeBody}</p>
      ) : (
        <>
          {revision.afterVersion === current.version ? null : (
            <p className="mt-2 text-sm text-muted">
              {words.laterSteps(revision.afterVersion, current.version)}
            </p>
          )}
          <p className="mt-4 text-lg font-semibold">
            {words.counter(revision.kept.counter.kept, revision.kept.counter.total)}
          </p>
          <section id="diff" aria-labelledby="diff-heading" className="mt-8">
            <h2 id="diff-heading" className="text-xl font-semibold">
              {words.diffHeading}
            </h2>
            <DiffTable revision={revision} names={names} />
          </section>
          <KeptLists kept={revision.kept} names={names} />
        </>
      )}
      <ReconfirmList vendors={view.vendors} lang={lang} />
      {levers}
      <div className="mt-8 space-y-4">
        <UndoForm lang={lang} token={token} id="undo-revision" />
        <p>
          <a
            href={`/${lang}/p/${token}`}
            className="inline-flex min-h-11 items-center font-semibold"
          >
            {words.backToPlan}
          </a>
        </p>
      </div>
    </div>
  );
}
