import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { locationOf } from '@/server/http/see-other';
import { loadPlanPage } from '@/server/view/plan-page';

import { PlanPageView } from './_plan/plan-page-view';

export default async function PlanPage({
  params,
}: {
  readonly params: Promise<{ lang: string; token: string }>;
}): Promise<ReactElement> {
  const page = await loadPlanPage(params);
  // A first brief still waiting on its questions has no plan yet; its check page is the page.
  if (page.view === null) {
    redirect(locationOf({ to: 'check', lang: page.lang, token: page.token }));
  }
  const last = page.state.ops.at(-1);
  return (
    <PlanPageView
      lang={page.lang}
      token={page.token}
      view={page.view}
      weights={page.data.budgetWeights}
      latestDelay={last?.kind === 'taskDelayed' ? last.taskId : null}
    />
  );
}
