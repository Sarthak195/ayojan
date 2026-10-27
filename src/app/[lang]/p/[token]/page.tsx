import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { unavailableReason } from '@/app/[lang]/form/form-view';
import { locationOf } from '@/server/http/see-other';
import { loadPlanPage } from '@/server/view/plan-page';

import { dateWords } from '../../_brief/words';
import { PlanPageView } from './_plan/plan-page-view';

/**
 * The plan's own heading is the title (occasion and date, as the h1 says). The token itself and
 * anything the user typed never reach it: only the occasion id and the date, both from data.
 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ lang: string; token: string }>;
}): Promise<Metadata> {
  const page = await loadPlanPage(params);
  if (page.view === null) return { title: page.dict.common.pageTitles.check };
  const { current } = page.view;
  return {
    title: page.dict.plan.title(
      current.version,
      page.dict.form.occasions[current.brief.occasion],
      dateWords(current.headline.eventDate, page.lang),
    ),
  };
}

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
