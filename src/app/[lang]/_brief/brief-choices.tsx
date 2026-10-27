import type { ReactElement, ReactNode } from 'react';

import { ChoiceGroup } from '@/components/form/choice-group';
import { DisclosureMarker, DISCLOSURE_GROUP, LINK_SUMMARY } from '@/components/layout/disclosure';
import type { BriefDraft } from '@/core/brief/brief-draft';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import { FunctionAnswer } from '@/schemas/plan/brief';
import {
  Category,
  Diet,
  FunctionName,
  GuestNeed,
  MustHave,
  Occasion,
  type Priority,
  VenueLimit,
} from '@/schemas/readings/vocabulary';

// The brief's choice rows, shared by the form twin and the check page so both post the same
// field names (BriefForm's) and show the same words. Every row starts at what is known: on the
// form "Standard", "Not sure" or unticked; on the check page the reading's own answer.

function capitalised(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

export function OccasionPicker({
  lang,
  value,
  error,
}: {
  readonly lang: Lang;
  readonly value: Occasion | null;
  readonly error?: ReactNode;
}): ReactElement {
  const words = dictionaryFor(lang).form;
  return (
    <ChoiceGroup
      id="occasion"
      name="occasion"
      type="radio"
      legend={words.occasionLegend}
      required
      error={error}
      choices={Occasion.options.map((occasion) => ({
        value: occasion,
        label: words.occasions[occasion],
        checked: occasion === value,
      }))}
    />
  );
}

export type BriefChoiceValues = Pick<
  BriefDraft,
  'functions' | 'priorities' | 'mustHaves' | 'needs' | 'diet' | 'venueLimits'
>;

function ticks<T extends string>(
  options: readonly T[],
  ticked: readonly T[],
  labels: Readonly<Record<T, string>>,
): { value: string; label: string; checked: boolean }[] {
  return options.map((option) => ({
    value: option,
    label: labels[option],
    checked: ticked.includes(option),
  }));
}

// Must-haves that only a wedding has. Dhol and the live counter suit any occasion, so they
// stay outside the fold.
const WEDDING_MUST_HAVES: readonly MustHave[] = ['mehndiArtist', 'choreographer'];

function FunctionRows({
  lang,
  values,
  showHint,
}: {
  readonly lang: Lang;
  readonly values: BriefChoiceValues;
  readonly showHint: boolean;
}): ReactElement {
  const words = dictionaryFor(lang).form;
  return (
    <fieldset className="my-4">
      <legend className="font-semibold">{words.functionsLegend}</legend>
      {showHint ? <p className="text-sm text-muted">{words.functionsHint}</p> : null}
      {FunctionName.options.map((name) => (
        <ChoiceGroup
          key={name}
          id={`function-${name}`}
          name={`function${capitalised(name)}`}
          type="radio"
          inline
          legend={words.functions[name]}
          choices={FunctionAnswer.options.map((answer) => ({
            value: answer,
            label: words.functionAnswers[answer],
            checked: values.functions[name] === answer,
          }))}
        />
      ))}
    </fieldset>
  );
}

/**
 * The form twin's wedding block. The occasion is picked on the same page and the page works
 * without JavaScript, so the block cannot react to the pick; it is folded instead. Closed, its
 * fields still post their defaults (Not sure, unticked), which is what an absent answer means.
 */
function WeddingOnly({
  lang,
  values,
}: {
  readonly lang: Lang;
  readonly values: BriefChoiceValues;
}): ReactElement {
  const words = dictionaryFor(lang).form;
  return (
    <details id="wedding-only" className={`my-4 ${DISCLOSURE_GROUP}`}>
      <summary className={LINK_SUMMARY}>
        {words.weddingOnlyTitle}
        <DisclosureMarker />
      </summary>
      <p className="text-sm text-muted">{words.weddingOnlyHint}</p>
      <FunctionRows lang={lang} values={values} showHint={false} />
      <ChoiceGroup
        id="must-have-wedding"
        name="mustHave"
        type="checkbox"
        legend={words.weddingMustHavesLegend}
        choices={ticks(WEDDING_MUST_HAVES, values.mustHaves, words.mustHaves)}
      />
    </details>
  );
}

export function BriefChoiceRows({
  lang,
  values,
  priorityChoices,
  showFunctions = true,
  foldWedding = false,
}: {
  readonly lang: Lang;
  readonly values: BriefChoiceValues;
  /** The form twin offers three answers; the check page adds "Not sure" (spec 6.3). */
  readonly priorityChoices: readonly Priority[];
  /** False hides the wedding function rows; the confirm route reads absent rows as unchanged. */
  readonly showFunctions?: boolean;
  /** True on the form twin: the functions and wedding must-haves sit in a closed "Wedding only". */
  readonly foldWedding?: boolean;
}): ReactElement {
  const words = dictionaryFor(lang).form;
  const generalMustHaves = foldWedding
    ? MustHave.options.filter((option) => !WEDDING_MUST_HAVES.includes(option))
    : MustHave.options;
  return (
    <>
      {foldWedding ? <WeddingOnly lang={lang} values={values} /> : null}
      {showFunctions && !foldWedding ? <FunctionRows lang={lang} values={values} showHint /> : null}
      <fieldset className="my-4">
        <legend className="font-semibold">{words.prioritiesLegend}</legend>
        {Category.options.map((category) => (
          <ChoiceGroup
            key={category}
            id={`priority-${category}`}
            name={`priority${capitalised(category)}`}
            type="radio"
            inline
            legend={words.categories[category]}
            choices={priorityChoices.map((level) => ({
              value: level,
              label: words.priorityAnswers[level],
              // A reading's "unclear" shows as Standard on the form, which has no Not sure.
              checked:
                values.priorities[category] === level ||
                (level === 'standard' &&
                  values.priorities[category] === 'unclear' &&
                  !priorityChoices.includes('unclear')),
            }))}
          />
        ))}
      </fieldset>
      <ChoiceGroup
        id="must-have"
        name="mustHave"
        type="checkbox"
        legend={words.mustHavesLegend}
        choices={ticks(generalMustHaves, values.mustHaves, words.mustHaves)}
      />
      <ChoiceGroup
        id="need"
        name="need"
        type="checkbox"
        legend={words.needsLegend}
        choices={ticks(GuestNeed.options, values.needs, words.needs)}
      />
      <ChoiceGroup
        id="diet"
        name="diet"
        type="checkbox"
        legend={words.dietLegend}
        choices={ticks(Diet.options, values.diet, words.diet)}
      />
      <ChoiceGroup
        id="venue-limit"
        name="venueLimit"
        type="checkbox"
        legend={words.venueLimitsLegend}
        choices={ticks(VenueLimit.options, values.venueLimits, words.venueLimits)}
      />
    </>
  );
}
