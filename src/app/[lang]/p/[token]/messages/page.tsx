import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { locationOf } from '@/server/http/see-other';
import { loadPlanPage } from '@/server/view/plan-page';

import { unavailableReason } from '../../../form/form-view';
import { messagesModel } from './_messages/messages-model';
import { MessagesView } from './_messages/messages-view';

export default async function MessagesPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ lang: string; token: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const page = await loadPlanPage(params);
  // A first brief still waiting on its questions has no plan to write about yet.
  if (page.view === null) {
    redirect(locationOf({ to: 'check', lang: page.lang, token: page.token }));
  }
  return (
    <MessagesView
      lang={page.lang}
      token={page.token}
      model={messagesModel(page.view, page.data, page.lang)}
      unavailable={unavailableReason(await searchParams)}
    />
  );
}
