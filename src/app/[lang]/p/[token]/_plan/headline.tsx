import type { ReactElement, ReactNode } from 'react';

import { Amount } from '@/components/money/amount';
import { Icon } from '@/components/status/icon';
import type { PlanHeadline } from '@/core/plan/plan-version';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { countWords, dateWords } from '../../../_brief/words';

function Row({
  term,
  children,
}: {
  readonly term: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-x-2 py-1">
      <dt className="font-medium">{term}:</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Budget, guests, date, venue capacity, projected cost, the gap and the status, each labelled. */
export function Headline({
  headline,
  lang,
}: {
  readonly headline: PlanHeadline;
  readonly lang: Lang;
}): ReactElement {
  const words = dictionaryFor(lang).plan;
  const { venue, gap } = headline;
  const over = headline.status === 'over-budget';
  const unpriced = headline.status === 'not-priced';
  return (
    <section aria-labelledby="headline-heading" className="mt-6">
      <h2 id="headline-heading" className="text-xl font-semibold">
        {words.headlineHeading}
      </h2>
      <dl className="mt-2">
        <Row term={words.budget}>
          <Amount money={headline.budget} lang={lang} />
        </Row>
        <Row term={words.guests}>{countWords(headline.guests)}</Row>
        <Row term={words.date}>{dateWords(headline.eventDate, lang)}</Row>
        <Row term={words.venue}>
          {venue.capacity === null
            ? words.venueUnknown
            : venue.source === 'booking'
              ? `${countWords(venue.capacity)} (${words.venueFromBooking})`
              : countWords(venue.capacity)}
        </Row>
        {/* With nothing priced the total is only the user's own split, so it is not called a cost, even
           when a change has pushed it over budget. */}
        <Row term={headline.priced ? words.projected : words.splitTotal}>
          <Amount money={headline.projected} lang={lang} />
        </Row>
        {/* Rs 0 left would read as a verdict the status below says is unknown. */}
        {unpriced ? null : (
          <Row term={over ? words.overBy : words.leftOver}>
            {/* The gap is projected minus budget; room left is shown as a positive amount. */}
            <Amount money={{ inr: Math.abs(gap.inr), provenance: gap.provenance }} lang={lang} />
          </Row>
        )}
        <Row term={words.status}>
          <span className="inline-flex items-center gap-1 font-medium">
            <Icon name={over ? 'triangle' : unpriced ? 'info' : 'check'} />
            {over ? words.overBudget : unpriced ? words.notPriced : words.withinBudget}
          </span>
          {unpriced ? <span>{` (${words.notPricedReason})`}</span> : null}
        </Row>
      </dl>
    </section>
  );
}
