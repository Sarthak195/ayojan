import type { ReactElement } from 'react';

import { loadLangPage } from '@/server/view/plan-page';

import { FormView, unavailableReason } from './form-view';

export default async function FormPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const { lang } = await loadLangPage(params);
  return <FormView lang={lang} unavailable={unavailableReason(await searchParams)} />;
}
