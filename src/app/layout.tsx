import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactElement, ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Ayojan',
  description: 'A planner for celebrations and events.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  // A prerendered page cannot carry the per-request CSP nonce, so its scripts would be
  // blocked and it would never hydrate. Opting the whole tree into dynamic rendering here
  // means no future page can forget to.
  await connection();

  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-black"
        >
          Skip to main content
        </a>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
