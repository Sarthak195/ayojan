'use client';

import { useState, useSyncExternalStore, type ReactElement } from 'react';

import { copyButtonName, copyFrom } from './island-logic';

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
 * screen reader say it; the visible label alone changing is not announced.
 */
export function CopyButtonView({
  label,
  doneLabel,
  heading,
  copied,
  onCopy,
}: {
  readonly label: string;
  readonly doneLabel: string;
  readonly heading: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
}): ReactElement {
  const shown = copied ? doneLabel : label;
  return (
    <>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copyButtonName(shown, heading)}
        className="mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-foreground px-4 font-semibold"
      >
        {shown}
      </button>
      <span role="status" className="sr-only">
        {copied ? `${doneLabel}: ${heading}` : ''}
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
  heading,
}: {
  readonly targetId: string;
  readonly label: string;
  readonly doneLabel: string;
  /** The message's heading, so the button's name tells several Copy buttons apart. */
  readonly heading: string;
}): ReactElement | null {
  const ready = useSyncExternalStore(subscribe, canCopy, () => false);
  const [copied, setCopied] = useState(false);
  if (!ready) return null;
  const copy = (): void => {
    const target = document.getElementById(targetId);
    if (!(target instanceof HTMLTextAreaElement)) return;
    void copyFrom(target, navigator.clipboard).then((done) => {
      if (done) setCopied(true);
    });
  };
  return (
    <CopyButtonView
      label={label}
      doneLabel={doneLabel}
      heading={heading}
      copied={copied}
      onCopy={copy}
    />
  );
}
