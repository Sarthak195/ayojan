// The running line under the lever boxes: "Selected saves Rs X; now Rs Y over budget" (FR-32).
// Structured first, so the server and any client island read the same numbers, then worded in
// either language. The sign of the gap picks over, under or exactly on budget.

import type { Money } from '../money/money';
import type { Language } from '../rupees/format';
import { formatRupees } from '../rupees/format';

export interface RunningLine {
  readonly kind: 'over' | 'under' | 'on-budget';
  /** What the selection closes: savings plus any budget raise. */
  readonly saves: Money;
  /** How far over or under the budget the plan then is; zero when exactly on budget. */
  readonly remaining: Money;
}

export function runningLine(closedInr: number, gapInr: number): RunningLine {
  return {
    kind: gapInr > 0 ? 'over' : gapInr < 0 ? 'under' : 'on-budget',
    saves: { inr: closedInr, provenance: 'computed' },
    remaining: { inr: Math.abs(gapInr), provenance: 'computed' },
  };
}

export function runningLineSentence(line: RunningLine, language: Language): string {
  const saves = formatRupees(line.saves.inr);
  const remaining = formatRupees(line.remaining.inr);
  if (language === 'en') {
    const now =
      line.kind === 'on-budget'
        ? 'now exactly on budget'
        : `now ${remaining} ${line.kind === 'over' ? 'over' : 'under'} budget`;
    return `Selected saves ${saves}; ${now}`;
  }
  const now =
    line.kind === 'on-budget'
      ? 'अब बजट के ठीक बराबर'
      : `अब बजट से ${remaining} ${line.kind === 'over' ? 'ज़्यादा' : 'कम'}`;
  return `चुने हुए से ${saves} की बचत; ${now}`;
}
