import type { ReactElement } from 'react';

import { BannerBox } from '@/components/banner/banners';
import { ChoiceGroup } from '@/components/form/choice-group';
import { TextField } from '@/components/form/fields';
import { PostForm, SubmitButton } from '@/components/form/post-form';
import { StatusSummary } from '@/components/layout/status-summary';
import { Amount } from '@/components/money/amount';
import type { IsoDate } from '@/core/calendar/day-number';
import {
  changeQuestions,
  type ChangeQuestion,
  type CurrentHeadline,
} from '@/core/plan/change-questions';
import { formatRupees } from '@/core/rupees/format';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { dateWords } from '../../../_brief/words';
import { ReadSource } from '../check/read-source';
import type { CategoryLabel } from './category-labels';
import { ChangeReadingList } from './change-reading-list';
import type { PendingChange } from './change-values';

export interface ChangeCheckViewProps {
  readonly lang: Lang;
  readonly token: string;
  readonly pending: PendingChange;
  readonly current: CurrentHeadline;
  readonly today: IsoDate;
  readonly labelOf: CategoryLabel;
  /** The recording date of an example reading (D18); null for anything else. */
  readonly recordedOn: string | null;
}

type Choosable = Extract<ChangeQuestion, { kind: 'budget-how-much' | 'which-date' }>;

function isChoosable(question: ChangeQuestion): question is Choosable {
  return question.kind === 'budget-how-much' || question.kind === 'which-date';
}

// A reason to enter the value again, not a choice this page can offer (confirmChange agrees).
function blockerText(question: ChangeQuestion, lang: Lang): string | null {
  const words = dictionaryFor(lang).change;
  switch (question.kind) {
    case 'nothing-to-change':
      return words.nothingToChange;
    case 'guests-out-of-range':
      return words.guestsOutOfRange(question.guests);
    case 'budget-out-of-range':
      return words.budgetOutOfRange(formatRupees(question.budgetInr));
    case 'date-passed':
      return words.datePassed(dateWords(question.date, lang));
    case 'move-unclear':
      return words.moveUnclear;
    case 'guests-unclear':
      return words.guestsUnclear;
    case 'date-unclear':
      return words.dateUnclear;
    case 'budget-how-much':
    case 'which-date':
      return null;
  }
}

function ChoiceQuestion({
  question,
  lang,
}: {
  readonly question: Choosable;
  readonly lang: Lang;
}): ReactElement {
  const words = dictionaryFor(lang).change;
  if (question.kind === 'which-date') {
    const [shift = '', written = ''] = question.candidates;
    // Nothing is checked: the family picks, the page never does (FR-24).
    return (
      <ChoiceGroup
        id="dateChoice"
        name="dateChoice"
        type="radio"
        required
        legend={words.whichDate}
        choices={[
          { value: 'shift', label: words.shiftOption(dateWords(shift, lang)) },
          { value: 'written', label: words.writtenOption(dateWords(written, lang)) },
        ]}
      />
    );
  }
  return (
    <>
      <ChoiceGroup
        id="budgetChoice"
        name="budgetChoice"
        type="radio"
        required
        legend={words.howMuch(words.direction[question.direction])}
        choices={[
          ...question.options.map((option) => ({
            value: option.percent === 5 ? 'percent5' : 'percent10',
            label: (
              <>
                {words.percentOption(option.percent)}:{' '}
                <Amount money={{ inr: option.budgetInr, provenance: 'computed' }} lang={lang} />
              </>
            ),
          })),
          { value: 'exact', label: words.exactOption },
        ]}
      />
      <TextField name="budgetExact" id="budgetExact" label={words.exactLabel} inputMode="text" />
    </>
  );
}

/** The change variant of the check page (spec 6.3): the reading, then only its open questions. */
export function ChangeCheckView({
  lang,
  token,
  pending,
  current,
  today,
  labelOf,
  recordedOn,
}: ChangeCheckViewProps): ReactElement {
  const dict = dictionaryFor(lang);
  const words = dict.change;
  const check = dict.check;
  const { readBy } = pending;
  // Recomputed from the sealed values on every GET, so a reload asks nothing new.
  const questions = changeQuestions(pending.values, current, today);
  const blockers = questions
    .map((question) => blockerText(question, lang))
    .filter((text): text is string => text !== null);
  const choices = questions.filter(isChoosable);
  const source =
    readBy.source === 'example'
      ? check.source.example(recordedOn ?? '?')
      : readBy.source === 'ai-cached'
        ? check.source.aiCached
        : check.source[readBy.source];
  return (
    <div>
      <h1 id="check-summary" tabIndex={-1} className="text-2xl font-bold">
        {check.title}
      </h1>
      <ReadSource readBy={readBy} label={source} lang={lang} />
      {readBy.source === 'form' ? null : (
        <p className="mt-1">{check.matched(readBy.matched, readBy.total)}</p>
      )}
      <StatusSummary>
        {blockers.length > 0
          ? words.summaryBlocked
          : choices.length > 0
            ? words.summaryQuestions(choices.length)
            : words.summaryReady}
      </StatusSummary>
      <section aria-labelledby="read-heading" className="mt-8">
        <h2 id="read-heading" className="text-xl font-semibold">
          {words.readingHeading}
        </h2>
        <ChangeReadingList pending={pending} current={current} labelOf={labelOf} lang={lang} />
      </section>
      {blockers.length > 0 ? (
        <>
          {blockers.map((text) => (
            <BannerBox key={text} tone="warning" lang={lang}>
              {text}
            </BannerBox>
          ))}
          <p className="mt-2">{words.reenter}</p>
        </>
      ) : (
        <PostForm lang={lang} route="confirm" token={token}>
          {choices.length === 0 ? null : (
            <h2 className="mt-8 text-xl font-semibold">{words.questionsHeading}</h2>
          )}
          {choices.map((question) => (
            <ChoiceQuestion key={question.kind} question={question} lang={lang} />
          ))}
          <div className="mt-6">
            <SubmitButton name="intent" value="confirm" describedBy="apply-hint">
              {words.apply}
            </SubmitButton>
            <p id="apply-hint" className="mt-2 text-sm text-muted">
              {words.applyHint}
            </p>
          </div>
        </PostForm>
      )}
      {/* Its own form, so the required answers above never block a cancel. */}
      <PostForm lang={lang} route="confirm" token={token}>
        <div className="mt-4">
          <SubmitButton name="intent" value="cancel" variant="secondary">
            {check.cancel}
          </SubmitButton>
        </div>
      </PostForm>
    </div>
  );
}
