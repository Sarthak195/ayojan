'use client';

import { useState, useSyncExternalStore, type ReactElement } from 'react';

function subscribe(): () => void {
  return () => undefined;
}

/** True only in a browser with the async clipboard, false on the server and during hydration. */
function canCopy(): boolean {
  return typeof navigator !== 'undefined' && 'clipboard' in navigator;
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
}: {
  readonly targetId: string;
  readonly label: string;
  readonly doneLabel: string;
}): ReactElement | null {
  const ready = useSyncExternalStore(subscribe, canCopy, () => false);
  const [copied, setCopied] = useState(false);
  if (!ready) return null;
  const copy = (): void => {
    const target = document.getElementById(targetId);
    if (!(target instanceof HTMLTextAreaElement)) return;
    navigator.clipboard.writeText(target.value).then(
      () => {
        setCopied(true);
      },
      () => {
        target.select();
      },
    );
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-foreground px-4 font-semibold"
    >
      {copied ? doneLabel : label}
    </button>
  );
}
