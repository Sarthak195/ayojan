'use client';

import { useEffect, useState, useSyncExternalStore, type ReactElement } from 'react';

import { copyButtonName, copyById, copyStatusText, type CopyStatus } from './island-logic';

/** How long "Copied" stays on the button, so a later copy shows and is announced again. */
const DONE_MS = 3000;

function subscribe(): () => void {
  return () => undefined;
}

/** True only in a browser with the async clipboard, false on the server and during hydration. */
function canCopy(): boolean {
  return typeof navigator !== 'undefined' && 'clipboard' in navigator;
}

/**
 * The button and its announcement, with no browser access, so it can be rendered in a test. The
 * status span is always in the page and its text arrives after a copy, which is what makes a
 * screen reader say it; the visible label alone changing is not announced. The button's name
 * stays "Copy: heading" so that only the status region speaks.
 */
export function CopyButtonView({
  label,
  doneLabel,
  failedText,
  heading,
  status,
  attempt,
  onCopy,
}: {
  readonly label: string;
  readonly doneLabel: string;
  readonly failedText: string;
  readonly heading: string;
  readonly status: CopyStatus;
  readonly attempt: number;
  readonly onCopy: () => void;
}): ReactElement {
  return (
    <>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copyButtonName(label, heading)}
        className="mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-foreground px-4 font-semibold"
      >
        {status === 'done' ? doneLabel : label}
      </button>
      <span role="status" className="sr-only">
        {copyStatusText(status, attempt, { done: doneLabel, failed: failedText }, heading)}
      </span>
    </>
  );
}

/**
 * Island 2 of 2 (arch 8): a Copy button for a read-only text area. On the server, and in a
 * browser without JavaScript or the clipboard, it renders nothing and the page's "Select the
 * text to copy it" line stands. If writing fails, the text is selected for a manual copy.
 */
export function CopyButton({
  targetId,
  label,
  doneLabel,
  failedText,
  heading,
}: {
  readonly targetId: string;
  readonly label: string;
  readonly doneLabel: string;
  /** Said (not shown) when the write is refused and the text has been selected instead. */
  readonly failedText: string;
  /** The message's heading, so the button's name tells several Copy buttons apart. */
  readonly heading: string;
}): ReactElement | null {
  const ready = useSyncExternalStore(subscribe, canCopy, () => false);
  const [{ status, attempt }, setState] = useState<{ status: CopyStatus; attempt: number }>({
    status: 'idle',
    attempt: 0,
  });
  useEffect(() => {
    if (status === 'idle') return undefined;
    const timer = setTimeout(() => {
      setState((was) => ({ ...was, status: 'idle' }));
    }, DONE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [status, attempt]);
  if (!ready) return null;
  const copy = (): void => {
    void copyById(document, targetId, navigator.clipboard).then((next) => {
      if (next !== 'idle') setState((was) => ({ status: next, attempt: was.attempt + 1 }));
    });
  };
  return (
    <CopyButtonView
      label={label}
      doneLabel={doneLabel}
      failedText={failedText}
      heading={heading}
      status={status}
      attempt={attempt}
      onCopy={copy}
    />
  );
}
