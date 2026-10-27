import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

export interface ScrollTableProps {
  /** Unique on the page; the caption gets `<id>-caption` and labels the scroll region. */
  readonly id: string;
  /** Language of the scroll hint shown on narrow screens. */
  readonly lang: Lang;
  readonly caption: ReactNode;
  /** A line under the caption, such as "Your split of your own budget, not prices." */
  readonly captionNote?: ReactNode;
  /** `<thead>` and `<tbody>`, with `scope` on every header cell. */
  readonly children: ReactNode;
}

const CAPTION_PIN: CSSProperties = {
  position: 'sticky',
  left: 0,
  boxSizing: 'border-box',
  width: 'min(100%, calc(100vw - 2.5rem))',
};

/**
 * A real table inside a focusable, labelled scroll region (D35). On a narrow screen the table
 * keeps its semantics and scrolls sideways; CSS that turns rows into cards would strip them in
 * Chrome and Safari. tabIndex 0 lets a keyboard user reach the region and scroll it.
 *
 * Sideways scrolling must be visible without JavaScript: globals.css paints edge shadows that
 * appear only while there is more to scroll and pins the row-label column, and a one-line hint
 * above the region (narrow screens only, outside the labelled region so its name stays the
 * caption) says so in words, because a shadow alone is easy to miss.
 */
export function ScrollTable({
  id,
  lang,
  caption,
  captionNote,
  children,
}: ScrollTableProps): ReactElement {
  const captionId = `${id}-caption`;
  return (
    <>
      <p className="mt-4 text-sm text-muted sm:hidden" data-table-hint="">
        <span aria-hidden="true">{'↔ '}</span>
        {dictionaryFor(lang).common.scrollTableHint}
      </p>
      <div
        id={id}
        role="region"
        tabIndex={0}
        aria-labelledby={captionId}
        className="table-scroll mt-1 mb-4 rounded border border-line sm:mt-4"
      >
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          {/* The caption is as wide as the table, so on a phone its sentence ran off the right
              edge until the region was scrolled. Pinning it to the region's left edge, at most
              the visible width, keeps it readable while the columns scroll under it. */}
          <caption id={captionId} className="px-3 py-2 text-left font-semibold" style={CAPTION_PIN}>
            {caption}
            {captionNote === undefined ? null : (
              <span className="block text-sm font-normal text-muted">{captionNote}</span>
            )}
          </caption>
          {children}
        </table>
      </div>
    </>
  );
}
