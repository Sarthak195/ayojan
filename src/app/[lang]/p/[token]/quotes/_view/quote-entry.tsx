import type { ReactElement } from 'react';

import { AiUnavailableBanner, type AiUnavailableReason } from '@/components/banner/banners';
import { TextArea } from '@/components/form/fields';
import { PostForm, ReadingHint, SubmitButton } from '@/components/form/post-form';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { QuoteInputs } from './quote-inputs';

const LINK = 'inline-flex min-h-11 items-center font-semibold';

/**
 * The paste box (spec 6.5). A sample link reloads this page with `?sample=a` or `b`, a closed
 * id, and the box starts filled with that committed text: the person can read it as it is or
 * edit it first, and no typed word ever travels in a URL.
 */
export function PasteSection({
  lang,
  token,
  sampleText,
}: {
  readonly lang: Lang;
  readonly token: string;
  readonly sampleText: string | null;
}): ReactElement {
  const words = dictionaryFor(lang).quotes;
  const here = `/${lang}/p/${token}/quotes`;
  return (
    <section id="quote-paste" aria-labelledby="paste-heading" className="mt-8">
      <h2 id="paste-heading" className="text-xl font-semibold">
        {words.pasteHeading}
      </h2>
      {sampleText === null ? null : <p className="mt-2 font-medium">{words.sampleNote}</p>}
      <PostForm lang={lang} route="read/quote" token={token}>
        <TextArea
          name="quote"
          label={words.pasteLabel}
          hint={words.pasteHint}
          {...(sampleText === null ? {} : { defaultValue: sampleText })}
          required
        />
        <SubmitButton describedBy="quote-read-hint">{words.readButton}</SubmitButton>
        <ReadingHint lang={lang} id="quote-read-hint" />
      </PostForm>
      <p className="mt-2">
        <a href="#quote-form" className={LINK}>
          {words.formFallback}
        </a>
      </p>
      <h3 className="mt-4 font-semibold">{words.samplesHeading}</h3>
      <ul className="mt-1">
        <li>
          <a href={`${here}?sample=a#quote-paste`} className={LINK}>
            {words.samplePerPlate}
          </a>
        </li>
        <li>
          <a href={`${here}?sample=b#quote-paste`} className={LINK}>
            {words.samplePackage}
          </a>
        </li>
      </ul>
    </section>
  );
}

/**
 * The quote form twin in a `<details>`, so it works without JavaScript. It opens by itself
 * when the AI reader was unavailable, under the banner that says why (FR-40).
 */
export function QuoteTwin({
  lang,
  token,
  unavailable,
}: {
  readonly lang: Lang;
  readonly token: string;
  readonly unavailable: AiUnavailableReason | null;
}): ReactElement {
  const words = dictionaryFor(lang).quotes;
  return (
    <section aria-label={words.formSummary} className="mt-6">
      {unavailable === null ? null : <AiUnavailableBanner lang={lang} reason={unavailable} />}
      <details id="quote-form" open={unavailable !== null} className="rounded border border-line">
        <summary className="inline-flex min-h-11 w-full cursor-pointer items-center px-3 font-semibold">
          {words.formSummary}
        </summary>
        <div className="px-3 pb-3">
          <p className="mt-2 text-sm text-muted">{words.formIntro}</p>
          <PostForm lang={lang} route="enter/quote" token={token}>
            <QuoteInputs lang={lang} prefix="twin" fields={null} />
            <SubmitButton>{words.addButton}</SubmitButton>
          </PostForm>
        </div>
      </details>
    </section>
  );
}
