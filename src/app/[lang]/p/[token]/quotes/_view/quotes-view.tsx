import type { ReactElement } from 'react';

import type { AiUnavailableReason } from '@/components/banner/banners';
import { StatusSummary } from '@/components/layout/status-summary';
import { Icon } from '@/components/status/icon';
import type { PlanView } from '@/core/plan/plan-view';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { BudgetWeightsFile } from '@/schemas/data/budget-weights';

import { nextSlot } from '../_quote/quote-record';
import { ComparisonTable } from './comparison-table';
import { PasteSection, QuoteTwin } from './quote-entry';

export interface QuotesViewProps {
  readonly lang: Lang;
  readonly token: string;
  readonly view: PlanView;
  readonly weights: BudgetWeightsFile;
  /** True when a read quote waits on its check page in this same link. */
  readonly hasPending: boolean;
  readonly unavailable: AiUnavailableReason | null;
  /** The committed sample text when the page was opened from a sample link. */
  readonly sampleText: string | null;
}

/** Questions for every quoted vendor, from data/vendor-questions.yaml in the page's language. */
function VendorQuestions({ view, lang }: { view: PlanView; lang: Lang }): ReactElement | null {
  const words = dictionaryFor(lang).quotes;
  const quoted = view.vendors.filter((contact) => contact.vendor.kind === 'quote');
  if (quoted.length === 0) return null;
  return (
    <section aria-labelledby="questions-heading" className="mt-8">
      <h2 id="questions-heading" className="text-xl font-semibold">
        {words.questionsHeading}
      </h2>
      {quoted.map((contact) => {
        const label = contact.label[lang];
        return (
          <div key={label} className="mt-4">
            <h3 className="font-semibold">{words.askVendor(label)}</h3>
            {contact.status === 'needs-reconfirmation' ? (
              <p className="mt-1 inline-flex items-center gap-1 font-medium">
                <Icon name="triangle" />
                <span>{words.needsReconfirmation}</span>
              </p>
            ) : null}
            {contact.questions.length === 0 ? (
              <p className="mt-1">{words.nothingToAsk}</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-6">
                {contact.questions.map((question) => (
                  <li key={question.id}>{question[lang]}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** The quotes page (spec 6.5): add a quote, then compare every category's quotes. */
export function QuotesView({
  lang,
  token,
  view,
  weights,
  hasPending,
  unavailable,
  sampleText,
}: QuotesViewProps): ReactElement {
  const words = dictionaryFor(lang).quotes;
  const { current } = view;
  const latest = view.ledger[0];
  const base = `/${lang}/p/${token}`;
  const profile = weights.profiles.find((row) => row.id === current.profile);
  const labelOf = (category: string): string =>
    profile?.categories.find((row) => row.category === category)?.[lang] ?? category;
  const full = nextSlot(current.quotes) === null;
  return (
    <div>
      <h1 className="text-2xl font-bold">{words.title}</h1>
      <StatusSummary>
        {words.summary(current.version, latest === undefined ? '' : latest[lang])}
      </StatusSummary>
      <p className="mt-2">{words.intro}</p>
      <p className="mt-2">
        <a href={base} className="inline-flex min-h-11 items-center font-semibold">
          {words.backToPlan}
        </a>
      </p>
      {hasPending ? (
        <p className="mt-2 inline-flex flex-wrap items-center gap-2">
          <Icon name="info" />
          <span>{words.pendingNote}</span>
          <a href={`${base}/check`} className="inline-flex min-h-11 items-center font-semibold">
            {words.pendingLink}
          </a>
        </p>
      ) : null}
      {full ? (
        <p className="mt-6 font-medium">{words.full}</p>
      ) : (
        <>
          <PasteSection lang={lang} token={token} sampleText={sampleText} />
          <QuoteTwin lang={lang} token={token} unavailable={unavailable} />
        </>
      )}
      {current.comparisons.length === 0 ? (
        <p className="mt-8">{words.emptyComparison}</p>
      ) : (
        current.comparisons.map((comparison) => (
          <ComparisonTable
            key={comparison.category}
            comparison={comparison}
            categoryLabel={labelOf(comparison.category)}
            allocation={current.money.projection.lines[comparison.category].allocation}
            lang={lang}
          />
        ))
      )}
      <VendorQuestions view={view} lang={lang} />
    </div>
  );
}
