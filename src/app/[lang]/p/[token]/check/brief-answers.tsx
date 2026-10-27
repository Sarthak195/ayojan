import type { ReactElement } from 'react';

import { TextField } from '@/components/form/fields';
import { PostForm, SubmitButton } from '@/components/form/post-form';
import { profileForOccasion } from '@/core/budget/budget-profile';
import type { BriefDraft } from '@/core/brief/brief-draft';
import type { BriefField, BriefQuestion } from '@/core/brief/questions';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';
import type { FieldVerdict } from '@/schemas/plan/state-token';

import { BriefChoiceRows, OccasionPicker } from '../../../_brief/brief-choices';
import { questionText, verdictFor } from './question-text';

export interface BriefAnswersProps {
  readonly lang: Lang;
  readonly token: string;
  readonly draft: BriefDraft;
  readonly questions: readonly BriefQuestion[];
  readonly fields: readonly FieldVerdict[];
  readonly weights: BudgetWeightsFile;
}

/**
 * Whether the wedding function rows belong on the page: for a wedding, an occasion still open,
 * or a reading that already answered a function (so that answer can still be changed). Hidden,
 * every function is "Not sure" in the draft, and an absent row keeps it so.
 */
export function showsFunctions(
  draft: BriefDraft,
  weights: BudgetWeightsFile,
  occasionAsked: boolean,
): boolean {
  if (occasionAsked || draft.occasion === null) return true;
  if (Object.values(draft.functions).some((answer) => answer !== 'unsure')) return true;
  const profile = profileForOccasion(weights, draft.occasion);
  return !profile.ok || profile.value.id === 'wedding';
}

/**
 * The editable half of the check page: every brief value as an input, prefilled with what was
 * understood, except an open question, whose input starts empty with its reason beside it.
 * Budget and guests accept Hindi number words ("dedh lakh"), parsed by core on confirm.
 */
export function BriefAnswers({
  lang,
  token,
  draft,
  questions,
  fields,
  weights,
}: BriefAnswersProps): ReactElement {
  const dict = dictionaryFor(lang);
  const words = dict.check;
  const form = dict.form;
  const asked = (field: BriefField): BriefQuestion | undefined =>
    questions.find((question) => question.field === field);
  const error = (field: BriefField): string | undefined => {
    const question = asked(field);
    return question === undefined
      ? undefined
      : questionText(question, verdictFor(field, fields), lang);
  };
  const withFunctions = showsFunctions(draft, weights, asked('occasion') !== undefined);
  const prefill = (field: BriefField, value: number | string | null): { defaultValue?: string } =>
    asked(field) !== undefined || value === null ? {} : { defaultValue: String(value) };

  return (
    <section aria-labelledby="answers-heading" className="mt-8">
      <h2 id="answers-heading" className="text-xl font-semibold">
        {words.answersHeading}
      </h2>
      <PostForm lang={lang} route="confirm" token={token} id="confirm-form">
        <OccasionPicker
          lang={lang}
          value={asked('occasion') === undefined ? draft.occasion : null}
          error={error('occasion')}
        />
        <TextField
          name="budget"
          label={form.budgetLabel}
          hint={form.numberHint}
          maxLength={40}
          error={error('budget')}
          {...prefill('budget', draft.budgetInr)}
        />
        <TextField
          name="guests"
          label={form.guestsLabel}
          hint={form.guestsHint}
          maxLength={40}
          error={error('guests')}
          {...prefill('guests', draft.guests)}
        />
        <TextField
          name="eventDate"
          type="date"
          label={form.dateLabel}
          error={error('eventDate')}
          {...prefill('eventDate', draft.eventDate)}
        />
        <TextField
          name="venueCapacity"
          label={form.capacityLabel}
          hint={form.capacityHint}
          optionalLabel={dict.common.optional}
          maxLength={40}
          error={error('venueCapacity')}
          {...prefill('venueCapacity', draft.venueCapacity)}
        />
        <h3 className="mt-6 text-lg font-semibold">
          {withFunctions ? words.choicesHeading : words.choicesHeadingNoFunctions}
        </h3>
        <BriefChoiceRows
          lang={lang}
          values={draft}
          priorityChoices={['more', 'standard', 'save', 'unclear']}
          showFunctions={withFunctions}
        />
        {draft.notes.length === 0 ? null : (
          <div className="my-4">
            <h3 className="text-lg font-semibold">{words.notedHeading}</h3>
            <p className="text-sm text-muted">{words.notedHint}</p>
            <ul className="mt-2 list-disc pl-6">
              {draft.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
        <SubmitButton name="intent" value="confirm">
          {words.confirm}
        </SubmitButton>
      </PostForm>
      {/* Its own form, so Cancel never waits on the questions above being answered. */}
      <PostForm lang={lang} route="confirm" token={token}>
        <div className="mt-4">
          <SubmitButton name="intent" value="cancel" variant="secondary" describedBy="cancel-hint">
            {words.cancel}
          </SubmitButton>
        </div>
        <p id="cancel-hint" className="mt-2 text-sm text-muted">
          {words.cancelHint}
        </p>
      </PostForm>
    </section>
  );
}
