import type { ReactElement } from 'react';

import type { StatusIconKey } from '@/core/timeline/status';

/** The five status silhouettes (core/timeline/status) plus the banner's info mark. */
export type IconName = StatusIconKey | 'info';

// Each shape differs in outline, not only in colour, so the icon still tells statuses apart
// in greyscale or for a reader who cannot see the colour (FR-13). Drawn by hand as paths on a
// 20 x 20 grid: no icon package, no image request.
const PATHS: Readonly<Record<IconName, readonly string[]>> = {
  check: ['M4 10.5l4 4 8-9'],
  octagon: ['M7 2h6l5 5v6l-5 5H7l-5-5V7z', 'M7.5 7.5l5 5M12.5 7.5l-5 5'],
  triangle: ['M10 2.5l8.5 15h-17z', 'M10 8v4.5', 'M10 15v.5'],
  clock: ['M10 2a8 8 0 1 0 0 16a8 8 0 1 0 0-16z', 'M10 5.5V10l3 2'],
  circle: ['M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14z'],
  info: ['M10 2a8 8 0 1 0 0 16a8 8 0 1 0 0-16z', 'M10 9v5', 'M10 6v.5'],
};

/**
 * Decorative: the word beside it carries the meaning, so the SVG is hidden from assistive
 * technology and never takes focus.
 */
export function Icon({
  name,
  className,
}: {
  readonly name: IconName;
  readonly className?: string;
}): ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ?? 'inline-block shrink-0'}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
