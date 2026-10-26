import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { locationOf } from '@/server/http/see-other';
import { loadPlanPage } from '@/server/view/plan-page';

import { RevisionView } from '../_revision/revision-view';

export default async function RevisionPage({
  params,
}: {
  readonly params: Promise<{ lang: string; token: string }>;
}): Promise<ReactElement> {
  const page = await loadPlanPage(params);
  // A first brief still waiting on its questions has no plan to revise yet.
  if (page.view === null) {
    redirect(locationOf({ to: 'check', lang: page.lang, token: page.token }));
  }
  return <RevisionView lang={page.lang} token={page.token} view={page.view} data={page.data} />;
}
