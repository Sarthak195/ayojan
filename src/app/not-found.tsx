import { connection } from 'next/server';
import type { ReactElement } from 'react';

import { ProblemView } from '@/components/problem/problem-view';
import { requestLang } from '@/server/view/request-lang';

export default async function NotFound(): Promise<ReactElement> {
  // The 404 page is prerendered by default, which strips the CSP nonce from its scripts.
  await connection();
  // not-found receives no params, so the language comes from the proxy's header.
  return <ProblemView lang={await requestLang()} problem="not-found" />;
}
