import type { ReactElement, ReactNode } from 'react';

/**
 * The line a section opens with after a 303 (D35), such as "Change applied: plan v6, over
 * budget by Rs 57,000". role="status" makes screen readers announce it without moving focus.
 * The page computes the words from the plan view (its version and latest ledger row), because
 * no user text, and no message, ever rides in the redirect URL.
 */
export function StatusSummary({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <p role="status" className="my-4 rounded bg-surface px-3 py-2 font-medium">
      {children}
    </p>
  );
}
