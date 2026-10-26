import 'server-only';

import type { IsoDate } from '@/core/calendar/day-number';
import type { BriefDraft } from '@/core/brief/brief-draft';
import { viewOfOps } from '@/core/plan/plan-view';
import type { Lang } from '@/i18n/lang';
import type { DataDocuments } from '@/schemas/data/data-files';
import type { Brief, ReadBy } from '@/schemas/plan/brief';
import type { Op } from '@/schemas/plan/op';
import { PendingReading } from '@/schemas/plan/state-token';
import type { StepOutcome } from '@/server/http/post-step';

// The two endings the form twin and the confirm step share, so a brief made either way is
// sealed, checked and redirected identically (FR-5).

/**
 * The first op of a plan, then a 303 to it. The plan is folded once here so a brief the
 * engines cannot plan is refused on this step (422) instead of sealing a link whose page
 * would only say "damaged".
 */
export function planFromBrief(
  brief: Brief,
  readBy: ReadBy,
  lang: Lang,
  data: DataDocuments,
  today: IsoDate,
): StepOutcome {
  const op: Op = { kind: 'briefConfirmed', brief, readBy };
  if (!viewOfOps([op], data, today).ok) return { kind: 'problem', problem: 'cannot-apply' };
  return {
    kind: 'next',
    state: { schema: 1, ops: [op] },
    to: (token) => ({ to: 'plan', lang, token }),
  };
}

/**
 * Back to the check page with what is understood so far, so a value that needs a question
 * is asked there and the valid answers are kept (arch D7). The questions themselves are
 * recomputed from the draft on every GET, so nothing but the draft rides in the link.
 */
export function checkAgain(
  draft: BriefDraft,
  fields: PendingReading['fields'],
  readBy: ReadBy,
  lang: Lang,
): StepOutcome {
  const pending = PendingReading.safeParse({ kind: 'brief', values: draft, fields, readBy });
  // Only a number too large to store safely gets here; it cannot be planned with either.
  if (!pending.success) return { kind: 'problem', problem: 'cannot-apply' };
  return {
    kind: 'next',
    state: { schema: 1, ops: [], pending: pending.data },
    to: (token) => ({ to: 'check', lang, token }),
  };
}
