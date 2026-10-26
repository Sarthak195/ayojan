import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { locationOf } from '@/server/http/see-other';
import { exampleBook } from '@/server/pipeline/example-readings';
import { loadPlanPage } from '@/server/view/plan-page';

import { CheckView } from './check-view';

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
