import 'server-only';

import {
  checkDraft,
  type DraftReason,
  type DraftVerdict,
  type OffendingNumber,
} from '@/core/messages/draft-check';
import type { MessageFacts } from '@/core/messages/fact-types';
import { reconfirmationQuestionIds } from '@/core/messages/message-facts';
import { familyUpdateTemplate, type FamilyUpdateTemplate } from '@/core/messages/templates';
import type { QuestionText } from '@/core/messages/vendor-messages';
import type { Language } from '@/core/rupees/format';
import type { QuestionId } from '@/schemas/generated/ids';
import { FamilyUpdateDraft } from '@/schemas/readings/family-update-draft';
import { readingCache, readingCacheKey, type ReadingCache } from '@/server/genai/reading-cache';
import { log } from '@/server/observability/logger';
import * as familyUpdate from '@/server/prompts/family-update';

import type { LlmGateway } from './llm-gateway';
import { extractOrForm, type Extraction, type FormCause } from './reading-outcome';
import { SCHEMA_VERSIONS } from './schema-versions';
import { stableJson } from './stable-json';

export interface FamilyUpdateInput {
  readonly facts: MessageFacts;
  readonly language: Language;
  /** The vendor question rows, so the model reads each follow-up as its wording, not its id. */
  readonly questions: readonly QuestionText[];
}

/** Why the template is shown instead of a draft. */
export type TemplateReason = 'rejected-numbers' | 'missing-questions' | 'empty' | 'unavailable';

export type FamilyUpdateResult =
  | {
      readonly kind: 'draft';
      readonly lines: readonly string[];
      readonly text: string;
      /** "numbers checked against your plan: n of n" (D07). */
      readonly label: string;
      readonly numbersChecked: number;
      readonly source: 'ai' | 'ai-cached';
      readonly answeredBy: string;
    }
  | {
      readonly kind: 'template';
      readonly template: FamilyUpdateTemplate;
      readonly reasons: readonly TemplateReason[];
      /** Known only when this request ran the check; a cached refusal keeps just its reasons. */
      readonly offendingNumbers: readonly OffendingNumber[];
      readonly missingQuestionIds: readonly QuestionId[];
      /** Set when the call itself failed: quota, timeout, no key, or our own bug. */
      readonly unavailable: FormCause | null;
    };

const DRAFT_REASONS: Readonly<Record<DraftReason, TemplateReason>> = {
  'number-not-in-facts': 'rejected-numbers',
  'number-unreadable': 'rejected-numbers',
  'question-missing': 'missing-questions',
  empty: 'empty',
};

function isDraftReason(text: string): text is DraftReason {
  return Object.hasOwn(DRAFT_REASONS, text);
}

function templateReasons(reasons: readonly string[]): TemplateReason[] {
  return [...new Set(reasons.filter(isDraftReason).map((reason) => DRAFT_REASONS[reason]))];
}

function template(
  input: FamilyUpdateInput,
  detail: Omit<Extract<FamilyUpdateResult, { kind: 'template' }>, 'kind' | 'template'>,
): FamilyUpdateResult {
  return {
    kind: 'template',
    template: familyUpdateTemplate(input.facts, input.language),
    ...detail,
  };
}

function verdictOf(input: FamilyUpdateInput, draft: FamilyUpdateDraft): DraftVerdict {
  return checkDraft({
    lines: draft.lines.map((line) => line.text),
    facts: input.facts,
    language: input.language,
    requiredQuestionIds: reconfirmationQuestionIds(input.facts),
  });
}

/** Accepts a draft only when the pure check passes; otherwise the template, with the reason. */
function judged(
  input: FamilyUpdateInput,
  draft: FamilyUpdateDraft,
  source: 'ai' | 'ai-cached',
  answeredBy: string,
): FamilyUpdateResult {
  const verdict = verdictOf(input, draft);
  if (!verdict.ok) {
    return template(input, {
      reasons: templateReasons(verdict.reasons),
      offendingNumbers: verdict.offendingNumbers,
      missingQuestionIds: verdict.missingQuestionIds,
      unavailable: null,
    });
  }
  const lines = draft.lines.map((line) => line.text);
  const checked = verdict.numbersFound;
  return {
    kind: 'draft',
    lines,
    text: lines.join('\n'),
    label: `numbers checked against your plan: ${String(checked)} of ${String(checked)}`,
    numbersChecked: checked,
    source,
    answeredBy,
  };
}

function resultOf(
  input: FamilyUpdateInput,
  extraction: Extraction<FamilyUpdateDraft>,
  rejected: DraftVerdict | undefined,
): FamilyUpdateResult {
  if (extraction.kind === 'form') {
    return template(input, {
      reasons: ['unavailable'],
      offendingNumbers: [],
      missingQuestionIds: [],
      unavailable: extraction.cause,
    });
  }
  if (extraction.kind === 'refused') {
    const detail = rejected !== undefined && !rejected.ok ? rejected : undefined;
    return template(input, {
      reasons: templateReasons(extraction.reason.split(',')),
      offendingNumbers: detail?.offendingNumbers ?? [],
      missingQuestionIds: detail?.missingQuestionIds ?? [],
      unavailable: null,
    });
  }
  const source = extraction.source === 'ai' ? 'ai' : 'ai-cached';
  return judged(input, extraction.value, source, extraction.answeredBy ?? 'unknown');
}

// The facts are the data block and part of the cache key; language and register change the
// draft, so they key it too. The GET of the messages page rebuilds exactly these inputs (D08).
function requestInputs(input: FamilyUpdateInput): { text: string; cacheInputs: string[] } {
  return {
    text: stableJson(familyUpdate.factsForModel(input.facts, input.language, input.questions)),
    cacheInputs: [input.language, familyUpdate.register],
  };
}

/**
 * Call 4 (G4, D07): one drafting call on request. The gateway runs the draft check before it
 * caches, so a rejected draft is cached as a refusal and asking again costs no call. The
 * accepted draft lives only in the reading cache under the facts hash, never in the link (D08).
 */
export async function draftFamilyUpdate(
  gateway: LlmGateway,
  input: FamilyUpdateInput,
): Promise<FamilyUpdateResult> {
  const { text, cacheInputs } = requestInputs(input);
  // Kept from the gateway's own run of the check, so a live rejection can name the numbers.
  let rejected: DraftVerdict | undefined;
  const extraction = await extractOrForm(gateway, {
    prompt: familyUpdate.promptFor(input.language),
    schema: FamilyUpdateDraft,
    schemaVersion: SCHEMA_VERSIONS.familyUpdate,
    text,
    origin: { kind: 'typed' },
    cacheInputs,
    check: (draft) => {
      const verdict = verdictOf(input, draft);
      if (verdict.ok) return undefined;
      rejected = verdict;
      return verdict.reasons.join(',');
    },
  });
  const result = resultOf(input, extraction, rejected);
  log.info('family-update', {
    promptId: familyUpdate.id,
    readingSource: result.kind === 'draft' ? result.source : 'template',
    ...(result.kind === 'template' ? { reason: result.reasons[0] } : {}),
  });
  return result;
}

/**
 * The GET of the messages page: the draft for these facts if the cache holds it, else null for
 * the template with the "Write it with AI" button. It never calls the model.
 */
export function cachedFamilyUpdate(
  input: FamilyUpdateInput,
  cache: ReadingCache = readingCache(),
  nowMs: number = Date.now(),
): FamilyUpdateResult | null {
  const { text, cacheInputs } = requestInputs(input);
  const key = readingCacheKey({
    promptId: familyUpdate.id,
    promptVersion: familyUpdate.version,
    schemaVersion: SCHEMA_VERSIONS.familyUpdate,
    text,
    extra: cacheInputs,
  });
  const hit = cache.get(key, nowMs);
  if (hit === undefined) return null;
  if (hit.kind === 'refused') {
    return template(input, {
      reasons: templateReasons(hit.reason.split(',')),
      offendingNumbers: [],
      missingQuestionIds: [],
      unavailable: null,
    });
  }
  const parsed = FamilyUpdateDraft.safeParse(JSON.parse(hit.json));
  return parsed.success ? judged(input, parsed.data, 'ai-cached', hit.answeredBy) : null;
}
