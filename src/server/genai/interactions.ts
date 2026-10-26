import 'server-only';

import { z } from 'zod';

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
