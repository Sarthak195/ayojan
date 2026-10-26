import 'server-only';

import * as brief from './brief';
import * as change from './change';
import * as familyUpdate from './family-update';
import * as quote from './quote';
import type { PromptIdentity } from './shared/guardrails';

// One list of every prompt, so the recorder, the fake gateway and the guardrail tests route
// on the same ids and a new prompt cannot be added without joining all three.
export const PROMPTS: readonly PromptIdentity[] = [brief, quote, change, familyUpdate];

export type PromptId =
  typeof brief.id | typeof quote.id | typeof change.id | typeof familyUpdate.id;
