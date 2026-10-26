import type { ReactElement, ReactNode } from 'react';

import { ChoiceGroup } from '@/components/form/choice-group';
import { TextField } from '@/components/form/fields';
import { Icon, type IconName } from '@/components/status/icon';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { FieldVerdict } from '@/schemas/plan/state-token';
import { Category, QuoteBasis, TaxTreatment } from '@/schemas/readings/vocabulary';

import type { QuoteFields } from '../_quote/quote-record';

/** The inputs both quote forms post, named as QuoteForm names them. */
export type QuoteInputName =
  | 'category'
  | 'basis'
  | 'rateInr'
  | 'minimumGuests'
  | 'guestsCovered'
  | 'tax'
  | 'liveCounterInr'
  | 'advancePercent';

/** What the check page says beside an input: the vendor's words, the verdict, a question. */
export interface FieldNote {
  readonly quote: string | null;
  readonly status: FieldVerdict['status'] | null;
  readonly question: string | null;
}

export type FieldNotes = Readonly<Partial<Record<QuoteInputName, FieldNote>>>;

const STATUS_ICON: Readonly<Record<FieldVerdict['status'], IconName>> = {
  verified: 'check',
  unverified: 'triangle',
  unclear: 'circle',
  absent: 'info',
};

/** The vendor's own words, highlighted, and whether code found them in the message. */
export function ReadWords({
  quote,
  status,
  lang,
}: {
  readonly quote: string | null;
  readonly status: FieldVerdict['status'] | null;
  readonly lang: Lang;
}): ReactElement | null {
  if (quote === null && status === null) return null;
  const dict = dictionaryFor(lang);
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2">
      {quote === null ? null : (
        <span>
          {dict.quotes.readWords}{' '}
          <mark className="rounded bg-note-bg px-1 text-foreground">
            <q>{quote}</q>
          </mark>
        </span>
      )}
      {status === null ? null : (
        <span className="inline-flex items-center gap-1">
          <Icon name={STATUS_ICON[status]} />
          <span>{dict.check.status[status]}</span>
        </span>
      )}
    </span>
  );
}

function noteParts(
  note: FieldNote | undefined,
  lang: Lang,
): { hint?: ReactNode; error?: ReactNode } {
  if (note === undefined) return {};
  const words = <ReadWords quote={note.quote} status={note.status} lang={lang} />;
  return {
    ...(note.quote === null && note.status === null ? {} : { hint: words }),
    ...(note.question === null ? {} : { error: note.question }),
  };
}

const text = (value: number | null): string => (value === null ? '' : String(value));

/**
 * Every quote value as a plain input with a visible label. On the check page each input starts
 * at the value read from the message and carries the vendor's words and any open question; in
 * the form twin they start empty. Radios without a starting value are required, so a browser
 * asks for them before posting.
 */
export function QuoteInputs({
  lang,
  prefix,
  fields,
  notes = {},
}: {
  readonly lang: Lang;
  readonly prefix: string;
  readonly fields: QuoteFields | null;
  readonly notes?: FieldNotes;
}): ReactElement {
  const dict = dictionaryFor(lang);
  const words = dict.quotes;
  const id = (name: string): string => `${prefix}-${name}`;
  const numberField = (name: QuoteInputName, label: string, value: number | null): ReactElement => (
    <TextField
      name={name}
      id={id(name)}
      label={label}
      inputMode="numeric"
      maxLength={9}
      defaultValue={text(value)}
      optionalLabel={dict.common.optional}
      {...(notes[name] === undefined ? { hint: words.numberHint } : noteParts(notes[name], lang))}
    />
  );
  const inclusions = fields?.inclusion ?? [];
  return (
    <>
      <ChoiceGroup
        id={id('category')}
        name="category"
        legend={words.categoryLegend}
        type="radio"
        required
        choices={Category.options.map((value) => ({
          value,
          label: dict.form.categories[value],
          checked: fields?.category === value,
        }))}
        {...noteParts(notes.category, lang)}
      />
      <ChoiceGroup
        id={id('basis')}
        name="basis"
        legend={words.basisLegend}
        type="radio"
        required
        inline
        choices={QuoteBasis.options.map((value) => ({
          value,
          label: words.basis[value],
          checked: fields?.basis === value,
        }))}
        {...noteParts(notes.basis, lang)}
      />
      {numberField('rateInr', words.rateLabel, fields?.rateInr ?? null)}
      {numberField('minimumGuests', words.minimumLabel, fields?.minimumGuests ?? null)}
      {numberField('guestsCovered', words.coveredLabel, fields?.guestsCovered ?? null)}
      <ChoiceGroup
        id={id('tax')}
        name="tax"
        legend={words.taxLegend}
        type="radio"
        required
        choices={TaxTreatment.options.map((value) => ({
          value,
          label: words.tax[value],
          checked: fields?.tax === value,
        }))}
        {...noteParts(notes.tax, lang)}
      />
      <TextField
        name="taxRatePercent"
        id={id('taxRatePercent')}
        label={words.taxRateLabel}
        inputMode="text"
        maxLength={5}
        defaultValue={fields?.taxRatePercent ?? ''}
        optionalLabel={dict.common.optional}
        hint={words.taxRateHint}
      />
      {numberField('liveCounterInr', words.liveCounterLabel, fields?.liveCounterInr ?? null)}
      {[0, 1, 2, 3].map((index) => (
        <TextField
          key={index}
          name="inclusion"
          id={id(`inclusion-${String(index + 1)}`)}
          label={words.inclusionLabel(index + 1)}
          maxLength={40}
          defaultValue={inclusions[index] ?? ''}
          optionalLabel={dict.common.optional}
        />
      ))}
      {numberField('advancePercent', words.advanceLabel, fields?.advancePercent ?? null)}
    </>
  );
}
