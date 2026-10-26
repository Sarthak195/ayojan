import 'server-only';

import type { z } from 'zod';

/** What every prompt module exports; the fake gateway and the recorder route on `id`. */
export interface PromptSpec {
  readonly id: string;
  readonly version: number;
  readonly system: string;
  /**
   * Returns only the instruction that follows the data block. It takes no text on purpose: the
   * gateway wraps the text in the delimiter itself, and a prompt that needed the text could
   * only send it a second time, outside the delimiter's protection. For the family update use
   * familyUpdate.promptFor(language); the readers (brief, quote, change) fit as modules.
   */
  readonly instruction: () => string;
}

/**
 * Who wrote the text. Only the caller can tell an exact example text from typed text, so it
 * hands over the committed recording with it (D18).
 */
export type TextOrigin<T> =
  { readonly kind: 'typed' } | { readonly kind: 'example'; readonly recording: T };

export interface ExtractionRequest<T> {
  readonly prompt: PromptSpec;
  readonly schema: z.ZodType<T>;
  readonly schemaVersion: string;
  /** The canonical text; it is the data block of the request and part of the cache key. */
  readonly text: string;
  readonly origin: TextOrigin<T>;
  /** Every other input that changes the answer (language, register), so it keys the cache. */
  readonly cacheInputs?: readonly string[];
  /** The caller's own check after the schema; a reason string makes the reply a refusal. */
  readonly check?: (value: T) => string | undefined;
}

/** The closed `why` of the form twin's banner. */
export type UnavailableReason = 'quota' | 'timeout' | 'nokey';

export type ReadSource = 'ai' | 'ai-cached';

export type GatewayResult<T> =
  | {
      readonly kind: 'reading';
      readonly source: ReadSource;
      readonly value: T;
      readonly answeredBy: string;
    }
  | {
      readonly kind: 'refused';
      readonly source: ReadSource;
      readonly reason: string;
      readonly answeredBy: string;
    }
  | { readonly kind: 'example'; readonly value: T }
  | { readonly kind: 'unavailable'; readonly reason: UnavailableReason };

/**
 * The one seam between the pipelines and the model. Tests drive the pipelines through a small
 * fake of this interface, so no pipeline test needs the SDK, a key or the network.
 */
export interface LlmGateway {
  extract<T>(request: ExtractionRequest<T>): Promise<GatewayResult<T>>;
}
