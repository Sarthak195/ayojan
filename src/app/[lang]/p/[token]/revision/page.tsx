import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { pageTitle } from '@/i18n/page-title';
import { locationOf } from '@/server/http/see-other';
import { loadPlanPage } from '@/server/view/plan-page';

import { RevisionView } from '../_revision/revision-view';
import { LeverSection, selectionOf } from './_levers/lever-section';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  return pageTitle(params, 'revision');
}

export default async function RevisionPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ lang: string; token: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const page = await loadPlanPage(params);
  // A first brief still waiting on its questions has no plan to revise yet.
  if (page.view === null) {
    redirect(locationOf({ to: 'check', lang: page.lang, token: page.token }));
  }
  // The levers always work on the current plan (D32); `?sel=` is a Recalculate's closed ids.
  const levers = (
    <LeverSection
      lang={page.lang}
      token={page.token}
      view={page.view}
      ops={page.state.ops}
      data={page.data}
      today={page.today}
      selection={selectionOf(await searchParams)}
    />
  );
  return (
    <RevisionView
      lang={page.lang}
      token={page.token}
      view={page.view}
      data={page.data}
      levers={levers}
    />
  );
}
