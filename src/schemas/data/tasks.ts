import { z } from 'zod';

import { Category, FunctionName, GuestNeed, MustHave } from '../readings/vocabulary';
import {
  Basis,
  Days,
  DurationDays,
  English,
  Hindi,
  Reviewed,
  RowId,
  planningRow,
} from './planning-row';

// A task is active when any one of its conditions holds. A list rather than one condition,
// because the mehndi artist is needed both when there is a mehndi function and when the
// family names the artist as a must-have.
const Activation = z.discriminatedUnion('when', [
  z.strictObject({ when: z.literal('always') }),
  z.strictObject({ when: z.literal('function'), function: FunctionName }),
  z.strictObject({ when: z.literal('mustHave'), mustHave: MustHave }),
  z.strictObject({ when: z.literal('need'), need: GuestNeed }),
]);

const LeadTime = { latestFinishDaysBefore: Days, durationDays: DurationDays };

// The small-celebration profile's own day counts (D40): a birthday planned seven weeks out
// would show every task Late against a wedding's three-month lead times. Null only on a
// wedding-only task, which that profile drops anyway (checked by the knowledge validator).
const CelebrationTiming = z.strictObject({ ...LeadTime, basis: Basis, reviewed: Reviewed });

const FasterAlternative = z.strictObject({
  en: English,
  hi: Hindi,
  ...LeadTime,
  celebration: z.strictObject(LeadTime).nullable(),
});

const TaskRow = z.strictObject({
  id: RowId,
  category: Category,
  ...planningRow,
  // Ids are plain strings here, not the generated enum: the enum is generated from this file,
  // so referential integrity is checked by the knowledge validator instead.
  dependsOn: z.array(RowId),
  ...LeadTime,
  celebration: CelebrationTiming.nullable(),
  activatedBy: z.array(Activation).min(1),
  weddingOnly: z.boolean(),
  // The one booking path (D10): marking this task done with an amount books this category.
  books: Category.nullable(),
  fasterAlternative: FasterAlternative.nullable(),
});

const Threshold = z.strictObject({ ...planningRow, days: Days.max(60) });

export const TasksFile = z.strictObject({
  thresholds: z.strictObject({ atRiskSlackDays: Threshold, dueSoonDays: Threshold }),
  tasks: z.array(TaskRow).min(1),
});
export type TasksFile = z.infer<typeof TasksFile>;
export type TaskRow = z.infer<typeof TaskRow>;
