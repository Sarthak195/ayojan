import type { ReactElement, ReactNode } from 'react';

import { Amount } from '@/components/money/amount';
import type { LeverOption } from '@/core/levers/lever-types';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

const BOX = 'mt-1 h-6 w-6 shrink-0';

/** "Saves Rs 38,000 Computed" or "Would save about Rs 15,900 Planning assumption: about 30 percent". */
function Saving({
  option,
  lang,
}: {
  readonly option: LeverOption;
  readonly lang: Lang;
}): ReactElement {
  const words = dictionaryFor(lang).levers;
  return (
    <span>
      {option.saving.provenance === 'assumption' ? words.wouldSave : words.saves}{' '}
      <Amount money={option.saving} lang={lang} percent={option.percent ?? undefined} />
    </span>
  );
}

/** Why a lever may not be chosen, in words (spec 6.6): a must-have, or a booked category. */
function blockedReason(option: LeverOption, lang: Lang): string | null {
  const dict = dictionaryFor(lang);
  const { reason } = option;
  if (reason === null) return null;
  if (reason.kind === 'must-have')
    return dict.levers.disabled(dict.form.mustHaves[reason.mustHave]);
  if (reason.kind === 'booked') return dict.levers.booked(dict.form.categories[reason.category]);
  return dict.levers.refused(dict.form.categories[reason.category]);
}

/**
 * One lever as a full-height label (44 px target): its box, its name, what it saves with the
 * provenance in the same row, its consequence, and "Why this number?" with the data's basis.
 * A refused lever keeps its saving and adds a "Show anyway" box; a blocked one is disabled and
 * says why, so the reason is text, never a greyed-out box alone.
 */
export function LeverRow({
  option,
  lang,
  ticked,
  extra,
}: {
  readonly option: LeverOption;
  readonly lang: Lang;
  readonly ticked: boolean;
  /** Lines the preview adds, such as "Also clears Print invitations: At risk". */
  readonly extra?: ReactNode;
}): ReactElement {
  const words = dictionaryFor(lang).levers;
  const id = `lever-${option.id}`;
  const blocked =
    option.status === 'disabled' ||
    option.status === 'not-applicable' ||
    (option.status === 'refused' && !option.showAnywayAllowed);
  const reason = blockedReason(option, lang);
  return (
    <li className="py-3">
      <div className="flex min-h-11 gap-3">
        <input
          type="checkbox"
          id={id}
          name="lever"
          value={option.id}
          defaultChecked={ticked && !blocked}
          disabled={blocked}
          aria-describedby={`${id}-detail`}
          className={BOX}
        />
        <label htmlFor={id} className="font-medium">
          {option.label[lang]}
        </label>
      </div>
      <div id={`${id}-detail`} className="pl-9">
        <p className="flex flex-wrap gap-x-2">
          <Saving option={option} lang={lang} />
          {option.status === 'refused' ? <strong>{words.notSuggested}</strong> : null}
        </p>
        {reason === null ? null : <p className="mt-1 font-medium">{reason}</p>}
        <p className="mt-1">{option.consequence[lang]}</p>
        {option.bufferLeft === null ? null : (
          <p className="mt-1">
            {words.bufferLeft}: <Amount money={option.bufferLeft} lang={lang} />
          </p>
        )}
        {extra}
      </div>
      {option.status === 'refused' && option.showAnywayAllowed ? (
        <div className="flex min-h-11 items-center gap-3 pl-9">
          <input
            type="checkbox"
            id={`${id}-anyway`}
            name="showAnyway"
            value={option.id}
            defaultChecked={ticked}
            className={BOX}
          />
          <label htmlFor={`${id}-anyway`}>
            {words.showAnyway}
            <span className="sr-only">: {option.label[lang]}</span>
          </label>
        </div>
      ) : null}
      <details className="pl-9">
        <summary className="inline-flex min-h-11 cursor-pointer items-center">
          {words.whyThisNumber}
          <span className="sr-only">: {option.label[lang]}</span>
        </summary>
        <p className="text-sm text-muted">{option.basis}</p>
      </details>
    </li>
  );
}
