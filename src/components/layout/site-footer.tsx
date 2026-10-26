import type { ReactElement } from 'react';

/** D27: the one sentence about storage, on every page in the page's language. */
export function SiteFooter({ privacy }: { readonly privacy: string }): ReactElement {
  return (
    <footer className="mt-12 border-t border-line">
      <p className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted">{privacy}</p>
    </footer>
  );
}
