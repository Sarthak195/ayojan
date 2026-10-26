import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { GatewayBugError } from '@/server/genai/classify';
import type { ExtractionRequest, GatewayResult, LlmGateway } from '@/server/pipeline/llm-gateway';
import {
  extractOrForm,
  formOutcome,
  formReadBy,
  readByOf,
  readingSourceLabel,
} from '@/server/pipeline/reading-outcome';

const Schema = z.object({ city: z.string() });
type City = z.infer<typeof Schema>;

const REQUEST: ExtractionRequest<City> = {
  prompt: { id: 'brief', version: 1, system: 'SYSTEM', instruction: () => 'INSTRUCTION' },
  schema: Schema,
  schemaVersion: '1',
  text: 'some text',
  origin: { kind: 'typed' },
};

// A gateway that answers one fixed result, or throws, whatever the request.
function gatewayGiving(result: GatewayResult<City> | Error): LlmGateway {
  return {
    extract<T>(): Promise<GatewayResult<T>> {
      if (result instanceof Error) return Promise.reject(result);
      // The fixed result was built for City, and every request here asks for City.
      return Promise.resolve(result as GatewayResult<T>);
    },
  };
}

describe('extractOrForm maps every gateway outcome', () => {
  it.each([
    [
      { kind: 'reading', source: 'ai', value: { city: 'Indore' }, answeredBy: 'gemini-3.6-flash' },
      { kind: 'value', source: 'ai', value: { city: 'Indore' }, answeredBy: 'gemini-3.6-flash' },
    ],
    [
      { kind: 'reading', source: 'ai-cached', value: { city: 'Indore' }, answeredBy: 'gemini-x' },
      { kind: 'value', source: 'ai-cached', value: { city: 'Indore' }, answeredBy: 'gemini-x' },
    ],
    [
      { kind: 'example', value: { city: 'Pune' } },
      { kind: 'value', source: 'example', value: { city: 'Pune' }, answeredBy: null },
    ],
    [
      { kind: 'refused', source: 'ai', reason: 'empty', answeredBy: 'gemini-x' },
      { kind: 'refused', source: 'ai', reason: 'empty', answeredBy: 'gemini-x' },
    ],
    [
      { kind: 'unavailable', reason: 'quota' },
      { kind: 'form', cause: 'quota' },
    ],
    [
      { kind: 'unavailable', reason: 'timeout' },
      { kind: 'form', cause: 'timeout' },
    ],
    [
      { kind: 'unavailable', reason: 'nokey' },
      { kind: 'form', cause: 'nokey' },
    ],
  ] as const)('%o', async (result, expected) => {
    await expect(extractOrForm(gatewayGiving(result), REQUEST)).resolves.toEqual(expected);
  });

  it.each(['bad-request', 'schema-violation'] as const)(
    'turns a %s GatewayBugError into the form, never a 500',
    async (kind) => {
      const gateway = gatewayGiving(new GatewayBugError(kind, 'test'));
      await expect(extractOrForm(gateway, REQUEST)).resolves.toEqual({
        kind: 'form',
        cause: 'our-bug',
      });
    },
  );

  it('lets any other failure propagate', async () => {
    const gateway = gatewayGiving(new TypeError('unexpected'));
    await expect(extractOrForm(gateway, REQUEST)).rejects.toThrow(TypeError);
  });
});

describe('formOutcome', () => {
  it('names the reason, and shows our own bug as a busy reader', () => {
    expect(formOutcome('quota')).toEqual({ kind: 'form', why: 'quota', cause: 'quota' });
    expect(formOutcome('nokey')).toEqual({ kind: 'form', why: 'nokey', cause: 'nokey' });
    expect(formOutcome('our-bug')).toEqual({ kind: 'form', why: 'timeout', cause: 'our-bug' });
  });
});

describe('provenance', () => {
  it('records the model that answered, cut to the token limit', () => {
    const readBy = readByOf('ai', `gemini-${'x'.repeat(60)}`, { matched: 3, total: 4 });
    expect(readBy.model).toHaveLength(40);
    expect(readBy).toMatchObject({ source: 'ai', matched: 3, total: 4 });
  });

  it('labels every source, and never shows a cache hit as a fresh read', () => {
    const counts = { matched: 1, total: 1 };
    expect(readingSourceLabel(readByOf('ai', 'gemini-x', counts), null)).toBe('Read by AI');
    expect(readingSourceLabel(readByOf('ai-cached', 'gemini-x', counts), null)).toMatch(
      /^Read by AI \(cached\)\. This exact text was read recently/,
    );
    expect(readingSourceLabel(readByOf('example', null, counts), '2026-10-27')).toBe(
      'Example reading, recorded on 2026-10-27; your own words are read live',
    );
    expect(readingSourceLabel(formReadBy(), null)).toBe('Entered by form');
    expect(formReadBy()).toEqual({ source: 'form', model: null, matched: 0, total: 0 });
  });
});
