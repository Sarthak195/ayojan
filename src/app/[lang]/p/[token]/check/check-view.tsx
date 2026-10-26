import type { ReactElement } from 'react';

import { PostForm, SubmitButton } from '@/components/form/post-form';
import { StatusSummary } from '@/components/layout/status-summary';
import { resolveBrief } from '@/core/brief/confirm-brief';
import type { BriefQuestion } from '@/core/brief/questions';
import type { IsoDate } from '@/core/calendar/day-number';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';
import type { ReadBy } from '@/schemas/plan/brief';
import type { PendingReading } from '@/schemas/plan/state-token';

import { BriefAnswers } from './brief-answers';
import { ReadList } from './read-list';

export interface CheckViewProps {
  readonly lang: Lang;
  readonly token: string;
  readonly pending: PendingReading;
  readonly today: IsoDate;
  readonly weights: BudgetWeightsFile;
  /** The recording date of an example reading (D18); null for anything else. */
  readonly recordedOn: string | null;
}

// How this reading was made, so a cached or example reading is never shown as a fresh read.
export function sourceLabel(readBy: ReadBy, recordedOn: string | null, lang: Lang): string {
  const words = dictionaryFor(lang).check.source;
  switch (readBy.source) {
    case 'ai':
      return words.ai;
    case 'ai-cached':
      return words.aiCached;
    case 'example':
      return words.example(recordedOn ?? '?');
    case 'form':
      return words.form;
  }
}

// Recomputed from the sealed draft on every GET: the questions are a function of the values,
// so reloading this page asks nothing new and never calls the model.
function openQuestions(
  pending: PendingReading,
  today: IsoDate,
  weights: BudgetWeightsFile,
): readonly BriefQuestion[] {
  if (pending.kind !== 'brief') return [];
  const resolution = resolveBrief({ draft: pending.values, answers: {} }, { today, weights });
  return resolution.ok ? [] : resolution.questions;
}

const FIELD_ID: Readonly<Record<BriefQuestion['field'], string>> = {
  occasion: 'occasion',
  budget: 'budget',
  guests: 'guests',
  eventDate: 'eventDate',
  venueCapacity: 'venueCapacity',
};

/** The check page (spec 6.3) for the pending reading sealed in the link. */
export function CheckView({
  lang,
  token,
  pending,
  today,
  weights,
  recordedOn,
}: CheckViewProps): ReactElement {
  const words = dictionaryFor(lang).check;
  const { readBy } = pending;
  const questions = openQuestions(pending, today, weights);
  return (
    <div>
      <h1 className="text-2xl font-bold">{words.title}</h1>
      <p className="mt-4 font-medium">{sourceLabel(readBy, recordedOn, lang)}</p>
      {readBy.source === 'form' ? null : (
        <p className="mt-1">{words.matched(readBy.matched, readBy.total)}</p>
      )}
      <StatusSummary>
        {pending.kind !== 'brief'
          ? words.otherKind
          : questions.length > 0
            ? words.summaryQuestions(questions.length)
            : words.summaryReady}
      </StatusSummary>
      {questions.length === 0 ? null : (
        <ul className="list-disc pl-6">
          {questions.map((question) => (
            <li key={question.field}>
              <a
                href={`#${FIELD_ID[question.field]}`}
                className="inline-flex min-h-11 items-center"
              >
                {words.questionMark}: {words.fields[question.field]}
              </a>
            </li>
          ))}
        </ul>
      )}
      {pending.fields.length === 0 ? null : (
        <section aria-labelledby="read-heading" className="mt-8">
          <h2 id="read-heading" className="text-xl font-semibold">
            {words.readHeading}
          </h2>
          <ReadList pending={pending} lang={lang} />
        </section>
      )}
      {pending.kind === 'brief' ? (
        <BriefAnswers
          lang={lang}
          token={token}
          draft={pending.values}
          questions={questions}
          fields={pending.fields}
          weights={weights}
        />
      ) : (
        <PostForm lang={lang} route="confirm" token={token}>
          <div className="mt-6">
            <SubmitButton name="intent" value="cancel" variant="secondary">
              {words.cancel}
            </SubmitButton>
          </div>
        </PostForm>
      )}
    </div>
  );
}
