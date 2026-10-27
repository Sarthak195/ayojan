import type { ReactElement } from 'react';

import { AiUnavailableBanner, type AiUnavailableReason } from '@/components/banner/banners';
import { TextField } from '@/components/form/fields';
import { PostForm, SubmitButton } from '@/components/form/post-form';
import { emptyDraft } from '@/core/brief/brief-draft';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { BriefChoiceRows, OccasionPicker } from '../_brief/brief-choices';

const REASONS: readonly AiUnavailableReason[] = ['quota', 'timeout', 'nokey'];

/** The banner's reason from `?ai=unavailable&why=`, a closed set; anything else shows none. */
export function unavailableReason(
  query: Readonly<Record<string, string | string[] | undefined>>,
): AiUnavailableReason | null {
  if (query.ai !== 'unavailable') return null;
  return REASONS.find((reason) => reason === query.why) ?? null;
}

/**
 * The brief form twin (spec 6.2): every brief value as a plain input, no model involved.
 * Required values start empty with no default; the choice rows start at Standard, Not sure or
 * unticked, which reads the same as a model leaving them unclear.
 */
export function FormView({
  lang,
  unavailable,
}: {
  readonly lang: Lang;
  readonly unavailable: AiUnavailableReason | null;
}): ReactElement {
  const dict = dictionaryFor(lang);
  const words = dict.form;
  return (
    <div>
      <h1 className="text-2xl font-bold">{words.title}</h1>
      {unavailable === null ? null : <AiUnavailableBanner lang={lang} reason={unavailable} />}
      <p className="mt-4">{words.intro}</p>
      <PostForm lang={lang} route="enter/brief" id="brief-form">
        <OccasionPicker lang={lang} value={null} />
        <TextField
          name="budget"
          label={words.budgetLabel}
          hint={words.numberHint}
          maxLength={40}
          required
        />
        <TextField
          name="guests"
          label={words.guestsLabel}
          hint={words.numberHint}
          maxLength={40}
          required
        />
        <TextField name="eventDate" type="date" label={words.dateLabel} required />
        <TextField
          name="venueCapacity"
          label={words.capacityLabel}
          optionalLabel={dict.common.optional}
          maxLength={40}
        />
        <BriefChoiceRows
          lang={lang}
          values={emptyDraft()}
          priorityChoices={['more', 'standard', 'save']}
          foldWedding
        />
        <SubmitButton>{words.submit}</SubmitButton>
      </PostForm>
    </div>
  );
}
