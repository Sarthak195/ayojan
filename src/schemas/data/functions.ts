import { z } from 'zod';

import { FunctionName } from '../readings/vocabulary';
import { RowId, planningRow } from './planning-row';

const FunctionRow = z.strictObject({
  id: FunctionName,
  ...planningRow,
  // Dropped with the small-celebration profile (D15).
  weddingOnly: z.boolean(),
  // Must equal the tasks whose `activatedBy` names this function; the validator checks both
  // directions, so the two files cannot drift apart.
  tasks: z.array(RowId),
});

export const FunctionsFile = z.strictObject({ functions: z.array(FunctionRow).min(1) });
export type FunctionsFile = z.infer<typeof FunctionsFile>;
