import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { locationOf } from '@/server/http/see-other';
import { exampleBook } from '@/server/pipeline/example-readings';
import { loadPlanPage } from '@/server/view/plan-page';

import { categoryLabels } from '../_change/category-labels';
import { ChangeCheckView } from '../_change/change-check-view';
import { headlineOf } from '../_change/change-values';
import { nextSlot } from '../quotes/_quote/quote-record';
import { QuoteCheckView } from '../quotes/_view/quote-check-view';
import { CheckView, sourceLabel } from './check-view';

export default async function CheckPage({
  params,
}: {
  readonly params: Promise<{ lang: string; token: string }>;
}): Promise<ReactElement> {
  const page = await loadPlanPage(params);
  const { pending } = page.state;
  // Nothing waits to be checked (it was confirmed or cancelled): the plan is the page.
  if (pending === undefined)
    redirect(locationOf({ to: 'plan', lang: page.lang, token: page.token }));
  const recordedOn =
    pending.readBy.source === 'example' ? (exampleBook().recordedOn(pending.kind) ?? null) : null;
  if (pending.kind === 'change' && page.view !== null) {
    const { profile } = page.view.current;
    return (
      <ChangeCheckView
        lang={page.lang}
        token={page.token}
        pending={pending}
        current={headlineOf(page.view)}
        today={page.today}
        labelOf={categoryLabels(page.data.budgetWeights, profile, page.lang)}
        recordedOn={recordedOn}
      />
    );
  }
  if (pending.kind === 'quote') {
    return (
      <QuoteCheckView
        lang={page.lang}
        token={page.token}
        pending={pending}
        source={sourceLabel(pending.readBy, recordedOn, page.lang)}
        slot={nextSlot(page.view?.current.quotes ?? [])}
      />
    );
  }
  return (
    <CheckView
      lang={page.lang}
      token={page.token}
      pending={pending}
      today={page.today}
      weights={page.data.budgetWeights}
      recordedOn={recordedOn}
    />
  );
}
