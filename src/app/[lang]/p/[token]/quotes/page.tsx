import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { locationOf } from '@/server/http/see-other';
import { loadPlanPage } from '@/server/view/plan-page';

import { unavailableReason } from '../../../form/form-view';
import { sampleIdOf, sampleQuoteText } from './_quote/sample-quotes';
import { QuotesView } from './_view/quotes-view';

export default async function QuotesPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ lang: string; token: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const page = await loadPlanPage(params);
  // A first brief still waiting on its questions has no plan to quote against yet.
  if (page.view === null) {
    redirect(locationOf({ to: 'check', lang: page.lang, token: page.token }));
  }
  const query = await searchParams;
  const sample = sampleIdOf(query.sample);
  return (
    <QuotesView
      lang={page.lang}
      token={page.token}
      view={page.view}
      weights={page.data.budgetWeights}
      hasPending={page.state.pending?.kind === 'quote'}
      unavailable={unavailableReason(query)}
      sampleText={sample === null ? null : sampleQuoteText(sample)}
    />
  );
}
