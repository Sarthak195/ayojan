import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import type { ReactElement, ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { SkipLink } from '@/components/layout/skip-link';
import { dictionaryFor } from '@/i18n/dictionary';
import { LANG_HEADER, langOfHeader, PATH_HEADER } from '@/i18n/path';

import './globals.css';

export const metadata: Metadata = {
  // Each page names itself; the template keeps the product name last so tabs stay distinct.
  title: { default: 'Ayojan', template: '%s: Ayojan' },
  description: 'A planner for celebrations and events.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  // A prerendered page cannot carry the per-request CSP nonce, so its scripts would be
  // blocked and it would never hydrate. Opting the whole tree into dynamic rendering here
  // means no future page can forget to.
  await connection();
  // The layout sits above the [lang] segment, so the proxy passes the language and path.
  const requestHeaders = await headers();
  const lang = langOfHeader(requestHeaders.get(LANG_HEADER));
  const pathname = requestHeaders.get(PATH_HEADER) ?? '';
  const { common } = dictionaryFor(lang);

  return (
    <html lang={lang}>
      <body className="min-h-screen">
        <SkipLink label={common.skipLink} />
        <SiteHeader lang={lang} pathname={pathname} common={common} />
        <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8">
          {children}
        </main>
        <SiteFooter privacy={common.privacyFooter} />
      </body>
    </html>
  );
}
