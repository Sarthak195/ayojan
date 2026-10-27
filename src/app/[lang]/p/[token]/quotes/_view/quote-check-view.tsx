import type { ReactElement } from 'react';

import { PostForm, SubmitButton } from '@/components/form/post-form';
import { StatusSummary } from '@/components/layout/status-summary';
import { Amount } from '@/components/money/amount';
import { quoteLabel } from '@/core/quotes/quote-wording';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { QuoteSlot } from '@/schemas/plan/quote-record';
import type { FieldVerdict, PendingReading } from '@/schemas/plan/state-token';

import { ReadSource } from '../../check/read-source';
import { fieldsFrom } from '../_quote/quote-record';
import {
  QuoteInputs,
  ReadWords,
  type FieldNote,
  type FieldNotes,
  type QuoteInputName,
} from './quote-inputs';

type QuotePending = Extract<PendingReading, { kind: 'quote' }>;

export interface QuoteCheckViewProps {
  readonly lang: Lang;
  readonly token: string;
  readonly pending: QuotePending;
  /** "Read by AI", "Entered by form" or the example label, worded by the check page. */
  readonly source: string;
  /** The letter this quote will take, or null when the plan already holds six. */
  readonly slot: QuoteSlot | null;
}

const INPUT_OF: Readonly<Record<string, QuoteInputName>> = {
  category: 'category',
  basis: 'basis',
  rateInr: 'rateInr',
  minimumGuests: 'minimumGuests',
  guestsCovered: 'guestsCovered',
  tax: 'tax',
  advancePercent: 'advancePercent',
};

function labelOf(name: string, lang: Lang): string {
  const words = dictionaryFor(lang).quotes;
  const labels: Readonly<Record<QuoteInputName, string>> = {
    category: words.categoryLegend,
    basis: words.basisLegend,
    rateInr: words.rateLabel,
    minimumGuests: words.minimumLabel,
    guestsCovered: words.coveredLabel,
    tax: words.taxLegend,
    liveCounterInr: words.liveCounterLabel,
    advancePercent: words.advanceLabel,
  };
  return INPUT_OF[name] === undefined ? name : labels[INPUT_OF[name]];
}

function questionFor(verdict: FieldVerdict, lang: Lang): string | null {
  const words = dictionaryFor(lang).quotes;
  if (verdict.reason === 'out-of-bounds' && verdict.field === 'advancePercent') {
    return words.advanceOutOfRange;
  }
  if (verdict.status === 'unverified') return words.unverifiedQuestion;
  return verdict.status === 'unclear' ? words.unclearQuestion : null;
}

// Each read value sits beside the vendor's words and its verdict; a value code could not
// match, or the model called unclear, carries a question. The category is the one value the
// quote cannot be stored without, so a missing category is always asked.
function notesOf(pending: QuotePending, lang: Lang): FieldNotes {
  const notes: Partial<Record<QuoteInputName, FieldNote>> = {};
  for (const verdict of pending.fields) {
    const name = INPUT_OF[verdict.field];
    if (name === undefined) continue;
    notes[name] = {
      quote: verdict.displayQuote,
      status: verdict.status,
      question: questionFor(verdict, lang),
    };
  }
  if (pending.values.category === null) {
    const read = notes.category;
    notes.category = {
      quote: read?.quote ?? null,
      status: read?.status ?? null,
      question: dictionaryFor(lang).quotes.categoryQuestion,
    };
  }
  return notes;
}

/** The check page for a read vendor quote (spec 5.4 step 2, FR-15). */
export function QuoteCheckView({
  lang,
  token,
  pending,
  source,
  slot,
}: QuoteCheckViewProps): ReactElement {
  const dict = dictionaryFor(lang);
  const words = dict.quotes;
  const { readBy, values } = pending;
  const notes = notesOf(pending, lang);
  const asked = Object.entries(notes).filter(([, note]) => note.question !== null);
  const others = pending.fields.filter((verdict) => INPUT_OF[verdict.field] === undefined);
  const otherExtras = values.extras.filter((extra) => extra.key === 'other');
  const button =
    slot === null
      ? words.addButton
      : values.category === null
        ? words.addAsSlot(slot)
        : words.addAs(quoteLabel({ category: values.category, id: slot }, lang));
  return (
    <div>
      <h1 id="check-summary" tabIndex={-1} className="text-2xl font-bold">
        {dict.check.title}
      </h1>
      <ReadSource readBy={readBy} label={source} lang={lang} />
      {readBy.source === 'form' ? null : (
        <p className="mt-1">{dict.check.matched(readBy.matched, readBy.total)}</p>
      )}
      <StatusSummary>
        {asked.length > 0 ? words.checkQuestions(asked.length) : words.checkReady}
      </StatusSummary>
      {asked.length === 0 ? null : (
        <ul className="list-disc pl-6">
          {asked.map(([name]) => (
            <li key={name}>
              <a href={`#check-${name}`} className="inline-flex min-h-11 items-center">
                {dict.check.questionMark}: {labelOf(name, lang)}
              </a>
            </li>
          ))}
        </ul>
      )}
      <PostForm lang={lang} route="confirm" token={token}>
        <QuoteInputs lang={lang} prefix="check" fields={fieldsFrom(values)} notes={notes} />
        {others.length === 0 && otherExtras.length === 0 ? null : (
          <section aria-labelledby="other-heading" className="mt-4">
            <h2 id="other-heading" className="text-lg font-semibold">
              {words.otherCharges}
            </h2>
            <ul className="mt-2 divide-y divide-line">
              {otherExtras.map((extra) => (
                <li key={`extra-${extra.label}`} className="py-2">
                  {extra.label}
                  {extra.amountInr === null ? null : (
                    <>
                      :{' '}
                      <Amount
                        money={{ inr: extra.amountInr, provenance: 'from-quote' }}
                        lang={lang}
                      />
                    </>
                  )}
                </li>
              ))}
              {others.map((verdict) => (
                <li key={verdict.field} className="py-2">
                  <ReadWords quote={verdict.displayQuote} status={verdict.status} lang={lang} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-6">
          <SubmitButton name="intent" value="confirm">
            {button}
          </SubmitButton>
        </div>
      </PostForm>
      {/* Its own form, so the required radios above never block leaving without a change. */}
      <PostForm lang={lang} route="confirm" token={token}>
        <div className="mt-3">
          <SubmitButton name="intent" value="cancel" variant="secondary">
            {dict.check.cancel}
          </SubmitButton>
        </div>
      </PostForm>
    </div>
  );
}
