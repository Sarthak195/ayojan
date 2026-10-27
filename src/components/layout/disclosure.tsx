import type { ReactElement } from 'react';

/**
 * Class names for a `<summary>` that must read as clickable. The default marker is gone because
 * the summaries are inline-flex (a 44 px target), so each style brings its own marker. The
 * focus ring comes from the global :focus-visible rule.
 */
const BASE = 'inline-flex min-h-11 cursor-pointer items-center gap-2';

/** The same outline as the secondary buttons beside it, so a disclosure reads as a button. */
export const BUTTON_SUMMARY = `${BASE} min-w-11 justify-center rounded border border-foreground bg-background px-4 font-semibold text-foreground`;

/** The underlined look of the page's links, for a disclosure that opens more of the page. */
export const LINK_SUMMARY = `${BASE} underline underline-offset-[0.15em]`;

/** The details element's class that lets the marker turn when it opens (Tailwind group-open). */
export const DISCLOSURE_GROUP = 'group';

/** A chevron that points right when closed and down when open; decorative, the state is announced natively. */
export function DisclosureMarker(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 group-open:rotate-90"
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}
