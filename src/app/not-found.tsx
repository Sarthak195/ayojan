import { connection } from 'next/server';
import type { ReactElement } from 'react';

export default async function NotFound(): Promise<ReactElement> {
  // The 404 page is prerendered by default, which strips the CSP nonce from its scripts.
  await connection();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-4">
        <a className="underline" href="/">
          Return to the home page
        </a>
      </p>
    </div>
  );
}
