import 'server-only';

import { z } from 'zod';

import { wrapUserText } from '@/server/prompts/shared/guardrails';

export type GeminiSchema = Readonly<Record<string, unknown>>;

// Gemini's schema subset ignores some of these and rejects over-complex schemas built from
// others, so they are removed before sending and enforced by Zod on the reply instead
// (validate twice). Descriptions stay: they are how the quote rule reaches the model.
export const PRUNED_SCHEMA_KEYWORDS: ReadonlySet<string> = new Set([
  '$schema',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'pattern',
  'format',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pruneNode(node: unknown): unknown {
  if (Array.isArray(node)) return node.map((child: unknown) => pruneNode(child));
  if (!isRecord(node)) return node;
  const pruned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'properties' && isRecord(value)) {
      // Keys under `properties` are field names, not keywords: a field called "format" stays.
      pruned[key] = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [name, pruneNode(child)]),
      );
    } else if (!PRUNED_SCHEMA_KEYWORDS.has(key)) {
      pruned[key] = pruneNode(value);
    }
  }
  return pruned;
}

/** The response schema sent to Gemini for a reading: Zod's JSON Schema minus validation keywords. */
export function toGeminiSchema(schema: z.ZodType): GeminiSchema {
  const pruned = pruneNode(z.toJSONSchema(schema));
  if (!isRecord(pruned)) throw new Error('A model schema must be a JSON object schema.');
  return pruned;
}

/**
 * Only the ladder's models can be named in a request, so `gemini-3.8-flash` (90 s in the probe)
 * or a preview model cannot be called by mistake.
 */
export type LadderModel = 'gemini-3.5-flash-lite' | 'gemini-3.1-flash-lite' | 'gemini-3.5-flash';

/**
 * Reasoning is steered by `thinking_level` alone. The SDK still accepts the deprecated sampling
 * knobs, so they are typed `never` here: no caller can set them, even through a spread.
 */
export interface GenerationConfig {
  readonly thinking_level: 'low';
  readonly temperature?: never;
  readonly top_p?: never;
  readonly top_k?: never;
}

export interface InteractionRequest {
  readonly model: LadderModel;
  readonly system_instruction: string;
  readonly input: string;
  readonly response_format: {
    readonly type: 'text';
    readonly mime_type: 'application/json';
    readonly schema: GeminiSchema;
  };
  readonly generation_config: GenerationConfig;
  readonly stream: false;
  readonly store: false;
}

/** SDK retries are off because the ladder decides what happens after a failure, not the SDK. */
export interface CallOptions {
  readonly timeout_ms: number;
  readonly retries: { readonly strategy: 'none' };
}

export interface InteractionReply {
  readonly output_text?: string | undefined;
  readonly model?: string | undefined;
  readonly usage?: { readonly total_tokens?: number | undefined } | undefined;
}

/** The narrow surface the gateway needs, so tests can stand in a fake without loading the SDK. */
export interface InteractionsClient {
  create(request: InteractionRequest, options: CallOptions): Promise<InteractionReply>;
}

export interface RequestParts {
  readonly model: LadderModel;
  readonly system: string;
  readonly text: string;
  readonly instruction: string;
  readonly schema: GeminiSchema;
}

/**
 * The only place a request is shaped (measured in the 26 Oct probe). The untrusted text sits
 * inside the delimiter and the instruction comes last, so the model reads the rule after the
 * data it governs; the system instruction is the stable prefix shared by every call. The
 * delimiter comes from the guardrails module, whose neutraliser also catches spaced, hyphenated
 * and entity-encoded closing tags (NFR-SEC-2); a second, weaker copy here would let one through.
 */
export function buildInteractionRequest(parts: RequestParts): InteractionRequest {
  return {
    model: parts.model,
    system_instruction: parts.system,
    input: `${wrapUserText(parts.text)}\n\n${parts.instruction}`,
    response_format: { type: 'text', mime_type: 'application/json', schema: parts.schema },
    generation_config: { thinking_level: 'low' },
    stream: false,
    // Ayojan never chains interactions, so nothing needs keeping for later retrieval.
    store: false,
  };
}

export function callOptions(timeoutMs: number): CallOptions {
  return { timeout_ms: timeoutMs, retries: { strategy: 'none' } };
}
