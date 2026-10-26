import 'server-only';

import type { ReadBy } from '@/schemas/plan/brief';
import type { PendingReading } from '@/schemas/plan/state-token';
import { GatewayBugError } from '@/server/genai/classify';
import { log } from '@/server/observability/logger';

import { exampleLabel } from './example-readings';
import type { ExtractionRequest, LlmGateway, UnavailableReason } from './llm-gateway';

/** Why the form twin is shown: the gateway's reasons, plus a failure that is ours to fix. */
export type FormCause = UnavailableReason | 'our-bug';

export type ReadSourceKind = 'ai' | 'ai-cached' | 'example';

export type Extraction<T> =
  | {
      readonly kind: 'value';
      readonly value: T;
      readonly source: ReadSourceKind;
      /** The model that answered, or null for an example whose recording names it instead. */
      readonly answeredBy: string | null;
    }
  | {
      /** The reply passed the schema but failed the caller's own check. */
      readonly kind: 'refused';
      readonly reason: string;
      readonly source: 'ai' | 'ai-cached';
      readonly answeredBy: string;
    }
  | { readonly kind: 'form'; readonly cause: FormCause };

/** What a route needs: render the check page, or 303 to the form twin with a banner. */
export type ReadingOutcome =
  | {
      readonly kind: 'check';
      readonly pending: PendingReading;
      /** Set for an example reading, for the D18 label; null otherwise. */
      readonly recordedOn: string | null;
    }
  | {
      readonly kind: 'form';
      /** The closed `why` of the banner (`?why=`): quota, timeout or nokey. */
      readonly why: UnavailableReason;
      readonly cause: FormCause;
    };

/**
 * One gateway call with every failure turned into a form-twin outcome. A GatewayBugError (a
 * 400, a non-JSON or schema-breaking reply) is our bug and reproduces on every model, so the
 * user gets the form, never a 500. Any other throw is unexpected and propagates.
 */
export async function extractOrForm<T>(
  gateway: LlmGateway,
  request: ExtractionRequest<T>,
): Promise<Extraction<T>> {
  const promptId = request.prompt.id;
  try {
    const result = await gateway.extract(request);
    if (result.kind === 'reading') {
      return {
        kind: 'value',
        value: result.value,
        source: result.source,
        answeredBy: result.answeredBy,
      };
    }
    if (result.kind === 'example') {
      return { kind: 'value', value: result.value, source: 'example', answeredBy: null };
    }
    if (result.kind === 'unavailable') {
      log.warn('reading-unavailable', { promptId, reason: result.reason });
      return { kind: 'form', cause: result.reason };
    }
    return {
      kind: 'refused',
      reason: result.reason,
      source: result.source,
      answeredBy: result.answeredBy,
    };
  } catch (error: unknown) {
    if (!(error instanceof GatewayBugError)) throw error;
    log.error('reading-gateway-bug', { promptId, reason: error.kind, errorName: error.name });
    return { kind: 'form', cause: 'our-bug' };
  }
}

/**
 * Our own bug is shown like a timeout ("the AI reader is busy"): the user can do nothing about
 * it, and the form gives the same plan either way.
 */
export function formOutcome(cause: FormCause): ReadingOutcome {
  return { kind: 'form', why: cause === 'our-bug' ? 'timeout' : cause, cause };
}

const MODEL_MAX = 40;

export function readByOf(
  source: ReadSourceKind,
  model: string | null,
  counts: { readonly matched: number; readonly total: number },
): ReadBy {
  return {
    source,
    model: model === null ? null : model.slice(0, MODEL_MAX),
    matched: counts.matched,
    total: counts.total,
  };
}

/** The form twin's provenance: nothing was read, so nothing was matched. */
export function formReadBy(): ReadBy {
  return { source: 'form', model: null, matched: 0, total: 0 };
}

export function checkOutcome(pending: PendingReading, recordedOn: string | null): ReadingOutcome {
  log.info('reading-checked', {
    promptId: pending.kind,
    readingSource: pending.readBy.source,
    verified: pending.readBy.matched,
    claimed: pending.readBy.total,
  });
  return { kind: 'check', pending, recordedOn };
}

/** The provenance line of the check screen and plan header (spec 9, D18), in English. */
export function readingSourceLabel(readBy: ReadBy, recordedOn: string | null): string {
  switch (readBy.source) {
    case 'ai':
      return 'Read by AI';
    case 'ai-cached':
      return 'Read by AI (cached). This exact text was read recently, so we reused that reading instead of spending the AI quota again';
    case 'example':
      return exampleLabel(recordedOn ?? 'an earlier day');
    case 'form':
      return 'Entered by form';
  }
}
