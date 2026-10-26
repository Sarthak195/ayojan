import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { unavailableReason } from '@/app/[lang]/form/form-view';
import { locationOf } from '@/server/http/see-other';
import { loadPlanPage } from '@/server/view/plan-page';

import { PlanPageView } from './_plan/plan-page-view';

export default async function PlanPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ lang: string; token: string }>;
  /** Optional so tests can render the page with params alone; Next always passes it. */
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
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
      changeUnavailable={unavailableReason((await searchParams) ?? {})}
    />
  );
}
