// The pure parts of the two client islands, kept apart so they can be unit-tested without a
// browser. Nothing here touches the document or the clipboard directly.

/** What the clipboard and a text area must offer for a copy; narrow so tests can fake it. */
export interface CopyTarget {
  readonly value: string;
  select(): void;
}

export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

/**
 * Writes the target's text to the clipboard. If that fails, selects the text so the person can
 * copy it by hand, and says so by returning false.
 */
export async function copyFrom(target: CopyTarget, clipboard: ClipboardLike): Promise<boolean> {
  try {
    await clipboard.writeText(target.value);
    return true;
  } catch {
    target.select();
    return false;
  }
}

/** What a copy attempt came to; "idle" is no attempt, or one whose announcement has timed out. */
export type CopyStatus = 'idle' | 'done' | 'failed';

/** The part of a document `copyById` needs, narrow so tests can fake it. */
export interface DocumentLike {
  getElementById(id: string): unknown;
}

function isTextArea(node: unknown): node is CopyTarget & { readonly tagName: string } {
  const candidate = node as { tagName?: unknown; value?: unknown; select?: unknown } | null;
  return (
    candidate !== null &&
    typeof candidate === 'object' &&
    candidate.tagName === 'TEXTAREA' &&
    typeof candidate.value === 'string' &&
    typeof candidate.select === 'function'
  );
}

/** Copies the text area with this id; "idle" if there is no such text area. */
export async function copyById(
  doc: DocumentLike,
  id: string,
  clipboard: ClipboardLike,
): Promise<CopyStatus> {
  const target = doc.getElementById(id);
  if (!isTextArea(target)) return 'idle';
  return (await copyFrom(target, clipboard)) ? 'done' : 'failed';
}

/**
 * The text of the hidden status region. A live region only speaks when its text changes, so
 * each attempt flips a trailing no-break space: a second copy of the same text is announced too.
 */
export function copyStatusText(
  status: CopyStatus,
  attempt: number,
  words: { readonly done: string; readonly failed: string },
  heading: string,
): string {
  if (status === 'idle') return '';
  const text = status === 'done' ? `${words.done}: ${heading}` : `${words.failed} ${heading}`;
  return attempt % 2 === 0 ? text : `${text} `;
}

/**
 * The button's accessible name: the visible text first (WCAG 2.5.3, label in name), then the
 * message heading, so several "Copy" buttons on one page can be told apart.
 */
export function copyButtonName(shown: string, heading: string): string {
  return `${shown}: ${heading}`;
}

/**
 * The lever key the server's table is indexed by: ticked levers in data order, and a refused
 * lever counts only once its "Show anyway" box is ticked too.
 */
export function runningTotalKey(
  order: readonly string[],
  needsShowAnyway: readonly string[],
  levers: ReadonlySet<string>,
  shown: ReadonlySet<string>,
): string {
  return order
    .filter((lever) => levers.has(lever) && (!needsShowAnyway.includes(lever) || shown.has(lever)))
    .join(',');
}

/** The string values a form holds under one name, as a set. */
export function tickedValues(values: readonly unknown[]): Set<string> {
  return new Set(values.filter((value): value is string => typeof value === 'string'));
}
