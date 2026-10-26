import { describe, expect, it } from 'vitest';

import { canonicalise } from '@/core/grounding/canonical-text';
import {
  createExampleBook,
  exampleLabel,
  loadExamples,
  type ReadRepoText,
} from '@/server/pipeline/example-readings';
import * as brief from '@/server/prompts/brief';
import * as quote from '@/server/prompts/quote';

import { CATERER_A, CATERER_A_READING, HINGLISH, HINGLISH_READING } from './readings';

function recording(
  promptId: string,
  promptVersion: number,
  reply: unknown,
  recordedOn = '2026-10-27',
) {
  return JSON.stringify({
    fixture: 'ignored-extra-key',
    promptId,
    promptVersion,
    schemaVersion: '1',
    answeredBy: 'gemini-3.5-flash-lite',
    recordedOn,
    reply,
  });
}

function repo(files: Readonly<Record<string, string>>): ReadRepoText {
  return (path) => files[path];
}

const FILES = {
  'fixtures/brief-hinglish.txt': `${HINGLISH}\n`,
  'golden/llm/brief-hinglish.brief.json': recording(brief.id, brief.version, HINGLISH_READING),
  'fixtures/quote-caterer-a.txt': CATERER_A,
  'golden/llm/quote-caterer-a.quote.json': recording(
    quote.id,
    quote.version,
    CATERER_A_READING,
    '2026-10-28',
  ),
};

describe('example readings (D18)', () => {
  it('finds a recording by the canonical text, so stray spaces and smart quotes still match', () => {
    const book = createExampleBook(loadExamples(repo(FILES)));
    const pasted = `  ${HINGLISH.replace('Dhol must hai.', 'Dhol   must hai.')}`;
    expect(book.find('brief', canonicalise(pasted).text)).toEqual({
      reply: HINGLISH_READING,
      answeredBy: 'gemini-3.5-flash-lite',
      recordedOn: '2026-10-27',
    });
    expect(book.find('quote', canonicalise(CATERER_A).text)?.recordedOn).toBe('2026-10-28');
  });

  it('never matches other text or another kind', () => {
    const book = createExampleBook(loadExamples(repo(FILES)));
    expect(book.find('brief', canonicalise(`${HINGLISH} aur DJ`).text)).toBeUndefined();
    expect(book.find('change', canonicalise(HINGLISH).text)).toBeUndefined();
    expect(book.find('quote', canonicalise(HINGLISH).text)).toBeUndefined();
  });

  it('skips a sample whose text or recording is missing or malformed', () => {
    expect(loadExamples(repo({}))).toEqual([]);
    const broken = { ...FILES, 'golden/llm/brief-hinglish.brief.json': '{ not json' };
    expect(loadExamples(repo(broken)).map((example) => example.kind)).toEqual(['quote']);
    const noDate = {
      ...FILES,
      'golden/llm/brief-hinglish.brief.json': JSON.stringify({ reply: {} }),
    };
    expect(loadExamples(repo(noDate)).map((example) => example.kind)).toEqual(['quote']);
  });

  it('refuses a recording made for another prompt version', () => {
    const stale = {
      ...FILES,
      'golden/llm/brief-hinglish.brief.json': recording(
        brief.id,
        brief.version + 1,
        HINGLISH_READING,
      ),
    };
    const book = createExampleBook(loadExamples(repo(stale)));
    expect(book.find('brief', canonicalise(HINGLISH).text)).toBeUndefined();
    expect(book.recordedOn('brief')).toBeUndefined();
    expect(book.recordedOn('quote')).toBe('2026-10-28');
  });

  it('labels the reading word for word', () => {
    expect(exampleLabel('2026-10-27')).toBe(
      'Example reading, recorded on 2026-10-27; your own words are read live',
    );
  });
});
