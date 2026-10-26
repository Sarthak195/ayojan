import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { BriefReading } from '@/schemas/readings/brief-reading';
import { ChangeReading } from '@/schemas/readings/change-reading';
import { FamilyUpdateDraft } from '@/schemas/readings/family-update-draft';
import { QuoteReading } from '@/schemas/readings/quote-reading';
import { CategoryOrUnclear } from '@/schemas/readings/vocabulary';
import { PRUNED_SCHEMA_KEYWORDS, toGeminiSchema } from '@/server/genai/interactions';

const modelSchemas: readonly (readonly [string, z.ZodType])[] = [
  ['BriefReading', BriefReading],
  ['QuoteReading', QuoteReading],
  ['ChangeReading', ChangeReading],
  ['FamilyUpdateDraft', FamilyUpdateDraft],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Depth counts every object and array level, root object = 1. `anyOf` (how Zod writes a
// nullable) is transparent, so `number | null` adds no level.
function depth(node: unknown): number {
  if (!isRecord(node)) return 0;
  const variants = Array.isArray(node.anyOf) ? node.anyOf : [];
  const fromVariants = Math.max(0, ...variants.map(depth));
  if (node.type === 'object' && isRecord(node.properties)) {
    return 1 + Math.max(0, ...Object.values(node.properties).map(depth), fromVariants);
  }
  if (node.type === 'array') return 1 + depth(node.items);
  return fromVariants;
}

// Every keyword anywhere in the tree, skipping field names under `properties`.
function keywords(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) keywords(child, found);
  } else if (isRecord(node)) {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'properties' && isRecord(value)) {
        for (const child of Object.values(value)) keywords(child, found);
      } else {
        found.add(key);
        keywords(value, found);
      }
    }
  }
  return found;
}

describe('model-schema-shape', () => {
  it.each(modelSchemas)('%s has depth at most 3 after toGeminiSchema', (_name, schema) => {
    expect(depth(toGeminiSchema(schema))).toBeLessThanOrEqual(3);
  });

  it.each(modelSchemas)('%s keeps no pruned keyword at any level', (_name, schema) => {
    const left = [...keywords(toGeminiSchema(schema))].filter((key) =>
      PRUNED_SCHEMA_KEYWORDS.has(key),
    );
    expect(left).toEqual([]);
  });

  it.each(modelSchemas)('%s uses no const branch and no $ref', (_name, schema) => {
    const found = keywords(toGeminiSchema(schema));
    expect(found.has('const')).toBe(false);
    expect(found.has('$ref')).toBe(false);
  });

  it('keeps descriptions, so the quote rule reaches the model', () => {
    expect(JSON.stringify(toGeminiSchema(BriefReading))).toContain('Exact words copied');
  });

  it('writes "or unclear" as one flat string enum', () => {
    expect(toGeminiSchema(CategoryOrUnclear)).toEqual({
      type: 'string',
      enum: ['venue', 'catering', 'decor', 'photo', 'music', 'invites', 'contingency', 'unclear'],
    });
  });

  it('measures depth the way the rule means it', () => {
    expect(depth(toGeminiSchema(FamilyUpdateDraft))).toBe(3);
  });

  it('keeps a field whose name is a keyword and prunes only the keyword', () => {
    const gemini = toGeminiSchema(z.object({ format: z.string().max(4) }));
    expect(gemini.properties).toEqual({ format: { type: 'string' } });
  });

  it('still enforces the pruned limits on the reply through Zod', () => {
    const tooMany = { lines: Array.from({ length: 7 }, () => ({ text: 'x' })) };
    expect(FamilyUpdateDraft.safeParse(tooMany).success).toBe(false);
  });
});
