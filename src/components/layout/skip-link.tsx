import type { ReactElement } from 'react';

/** The first focusable element on every page; hidden until a keyboard user tabs to it. */
export function SkipLink({ label }: { readonly label: string }): ReactElement {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded focus:bg-background focus:px-4 focus:text-foreground"
    >
      {label}
    </a>
  );
}
