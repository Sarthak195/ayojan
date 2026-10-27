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
