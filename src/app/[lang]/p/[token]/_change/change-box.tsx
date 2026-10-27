import type { ReactElement } from 'react';

import { AiUnavailableBanner, type AiUnavailableReason } from '@/components/banner/banners';
import { ChoiceGroup } from '@/components/form/choice-group';
import { TextArea, TextField } from '@/components/form/fields';
import { PostForm, ReadingHint, SubmitButton } from '@/components/form/post-form';
import { DISCLOSURE_GROUP, DisclosureMarker, LINK_SUMMARY } from '@/components/layout/disclosure';
import { exampleText } from '@/app/[lang]/_brief/example-text';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import { Category } from '@/schemas/readings/vocabulary';

import type { CategoryLabel } from './category-labels';

// The change form's priority field per category (schemas/forms/change-form.ts).
const PRIORITY_FIELD: Readonly<Record<Category, string>> = {
  venue: 'priorityVenue',
  catering: 'priorityCatering',
  decor: 'priorityDecor',
  photo: 'priorityPhoto',
  music: 'priorityMusic',
  invites: 'priorityInvites',
  contingency: 'priorityContingency',
};

const LEVELS = ['more', 'standard', 'save'] as const;

/**
 * "What changed?" on the plan page (spec 6.4, FR-23, FR-30): a free-text box read by the
 * model, and the form twin in a details element. The form's radio rows start on "No change"
 * (an empty value), which means "keep it", so nothing is ever decided for the family. When
 * the reader was unavailable the 303 lands here with the reason, and the form opens.
 */
export function ChangeBox({
  lang,
  token,
  labelOf,
  unavailable,
}: {
  readonly lang: Lang;
  readonly token: string;
  readonly labelOf: CategoryLabel;
  readonly unavailable: AiUnavailableReason | null;
}): ReactElement {
  const dict = dictionaryFor(lang);
  const words = dict.change;
  const example = exampleText('change');
  return (
    <section id="change-form" aria-labelledby="change-heading" className="mt-8">
      <h2 id="change-heading" className="text-xl font-semibold">
        {words.boxHeading}
      </h2>
      {unavailable === null ? null : <AiUnavailableBanner lang={lang} reason={unavailable} />}
      <p className="mt-2">{words.boxIntro}</p>
      <PostForm lang={lang} route="read/change" token={token}>
        <TextArea
          name="change"
          id="change-text"
          label={words.textLabel}
          hint={words.textHint}
          required
          rows={3}
        />
        <SubmitButton describedBy="change-reading-hint">{words.readButton}</SubmitButton>
        <ReadingHint lang={lang} id="change-reading-hint" />
      </PostForm>
      {/* The exact committed sentence, so a spent reserve serves its labelled recording (D18). */}
      {example === null ? null : (
        <PostForm lang={lang} route="read/change" token={token}>
          <p id="change-example-note" className="mt-4">
            {words.exampleNote}
          </p>
          <input type="hidden" name="change" value={example} />
          <div className="mt-2">
            <SubmitButton variant="secondary" describedBy="change-example-note change-example-hint">
              {words.exampleButton}
            </SubmitButton>
          </div>
          <ReadingHint lang={lang} id="change-example-hint" />
        </PostForm>
      )}
      <details className={`mt-4 ${DISCLOSURE_GROUP}`} open={unavailable !== null}>
        <summary className={LINK_SUMMARY}>
          {words.formSummary}
          <DisclosureMarker />
        </summary>
        <PostForm lang={lang} route="enter/change" token={token}>
          <p className="mt-2 text-sm text-muted">{words.formIntro}</p>
          <TextField
            name="guests"
            id="change-guests"
            label={words.guestsLabel}
            inputMode="numeric"
          />
          <TextField name="budget" id="change-budget" label={words.budgetLabel} inputMode="text" />
          <TextField name="eventDate" id="change-date" label={words.dateLabel} type="date" />
          <TextField
            name="moveAmount"
            id="change-move-amount"
            label={words.moveAmountLabel}
            inputMode="text"
          />
          <ChoiceGroup
            id="change-move-to"
            name="moveTo"
            type="radio"
            legend={words.moveToLegend}
            choices={[
              { value: '', label: words.noMove, checked: true },
              ...Category.options.map((category) => ({
                value: category,
                label: labelOf(category),
              })),
            ]}
          />
          <h3 className="mt-6 text-lg font-semibold">{words.priorityLegend}</h3>
          {Category.options.map((category) => (
            <ChoiceGroup
              key={category}
              id={`change-priority-${category}`}
              name={PRIORITY_FIELD[category]}
              type="radio"
              inline
              legend={words.priorityRow(labelOf(category))}
              choices={[
                { value: '', label: words.noChange, checked: true },
                ...LEVELS.map((level) => ({
                  value: level,
                  label: dict.form.priorityAnswers[level],
                })),
              ]}
            />
          ))}
          <SubmitButton>{words.formApply}</SubmitButton>
        </PostForm>
      </details>
    </section>
  );
}
