import { connection } from 'next/server';
import type { ReactElement } from 'react';

import { ProblemView } from '@/components/problem/problem-view';
import { requestLang } from '@/server/view/request-lang';

/**
 * A damaged, tampered or older plan link (D6): a 404 page that says so and offers a new plan,
 * never half a plan. It receives no params, so the language comes from the proxy's header.
 */
export default async function DamagedLink(): Promise<ReactElement> {
  // Prerendering would strip the per-request CSP nonce from this page's scripts.
  await connection();
  return <ProblemView lang={await requestLang()} problem="damaged-link" />;
}
