import type { ReactElement } from 'react';

import { BannerBox, type AiUnavailableReason } from '@/components/banner/banners';
import { PostForm, SubmitButton } from '@/components/form/post-form';
import { CopyButton } from '@/components/islands/copy-button.client';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { boxRows } from './box-rows';
import type { MessagesModel } from './messages-model';

const BOX =
  'block w-full rounded border border-line bg-surface px-3 py-2 text-base text-foreground';

/** A read-only message with its label, the no-JavaScript hint and the Copy island. */
function MessageBox({
  id,
  title,
  label,
  text,
  lang,
}: {
  readonly id: string;
  readonly title: string;
  readonly label: string;
  readonly text: string;
  readonly lang: Lang;
}): ReactElement {
  const words = dictionaryFor(lang).messages;
  return (
    <div className="my-4">
      <label htmlFor={id} className="block font-medium">
        {title}
      </label>
      <p id={`${id}-label`} className="mt-1 text-sm text-muted">
        {label}
      </p>
      <textarea
        id={id}
        readOnly
        defaultValue={text}
        rows={boxRows(text)}
        aria-describedby={`${id}-label ${id}-hint`}
        className={BOX}
      />
      <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
        {words.selectToCopy}
      </p>
      <CopyButton targetId={id} label={words.copy} doneLabel={words.copied} />
    </div>
  );
}

/**
 * Messages to send (spec 6.7, C8): the family update and one message per vendor. The family
 * update is the template unless a checked AI draft is cached for these facts; a rejected or
 * failed draft is never shown, the template is, with the reason (FR-35).
 */
export function MessagesView({
  lang,
  token,
  model,
  unavailable,
}: {
  readonly lang: Lang;
  readonly token: string;
  readonly model: MessagesModel;
  readonly unavailable: AiUnavailableReason | null;
}): ReactElement {
  const dict = dictionaryFor(lang);
  const words = dict.messages;
  const { drafted, template, vendors } = model;
  const draft = drafted?.kind === 'draft' ? drafted : null;
  const reasons = drafted?.kind === 'template' ? drafted.reasons : [];
  return (
    <div>
      <h1 className="text-2xl font-bold">{words.title}</h1>
      <section id="family" aria-labelledby="family-heading" className="mt-6">
        <h2 id="family-heading" className="text-xl font-semibold">
          {words.familyHeading}
        </h2>
        {unavailable === null ? null : (
          <BannerBox tone="warning" lang={lang}>
            {words.unavailable(dict.common.banner.aiReason[unavailable])}
          </BannerBox>
        )}
        {reasons.map((reason) => (
          <BannerBox key={reason} tone="note" lang={lang}>
            {words.templateBecause[reason]}
          </BannerBox>
        ))}
        <MessageBox
          id="family-text"
          title={words.familyBox}
          label={draft === null ? template.label : words.aiLabel(draft.numbersChecked)}
          text={draft === null ? template.text : draft.text}
          lang={lang}
        />
        {drafted === null ? (
          <PostForm lang={lang} route="messages" token={token}>
            <SubmitButton describedBy="write-hint">{words.writeWithAi}</SubmitButton>
            <p id="write-hint" className="mt-2 text-sm text-muted">
              {words.writeHint} {dict.common.privacyHint}
            </p>
          </PostForm>
        ) : (
          <p className="text-sm text-muted">{words.askedAlready}</p>
        )}
      </section>
      <section id="vendors" aria-labelledby="vendors-heading" className="mt-8">
        <h2 id="vendors-heading" className="text-xl font-semibold">
          {words.vendorHeading}
        </h2>
        {vendors.length === 0 ? <p className="mt-2">{words.noVendors}</p> : null}
        {vendors.map((vendor, index) => (
          <MessageBox
            key={`${vendor.category}-${vendor.vendor.en}`}
            id={`vendor-${String(index)}-text`}
            title={words.vendorBox(vendor.vendor[lang])}
            label={vendor.label}
            text={vendor.text}
            lang={lang}
          />
        ))}
      </section>
      <p className="mt-8">
        <a href={`/${lang}/p/${token}`} className="inline-flex min-h-11 items-center font-semibold">
          {words.backToPlan}
        </a>
      </p>
    </div>
  );
}
