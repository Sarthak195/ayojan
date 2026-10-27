import { describe, expect, it } from 'vitest';

import type { MessageFacts } from '@/core/messages/fact-types';
import {
  cachedFamilyUpdate,
  draftFamilyUpdate,
  type FamilyUpdateInput,
} from '@/server/pipeline/draft-family-update';
import { stableJson } from '@/server/pipeline/stable-json';
import * as familyUpdate from '@/server/prompts/family-update';

import type { FakeReply } from '../../../fakes/llm-gateway';
import { dataQuestions, makeFacts } from '../../core/messages/facts-fixture';
import { harness } from '../genai/ladder-harness';
import { gatewayAnswering } from './readings';

const TOPICS = [
  'The date and guest count changed, so each vendor will confirm.',
  'We will ask the venue about capacity.',
];
const ACCEPTED = [
  'Namaste sab ko!',
  'The budget is now Rs 15,00,000 and we expect 250 guests.',
  ...TOPICS,
];
const INVENTED = ['The budget is now Rs 17,00,000.', ...TOPICS];

const draftOf = (lines: readonly string[]) => ({ lines: lines.map((text) => ({ text })) });

function input(facts: MessageFacts = makeFacts()): FamilyUpdateInput {
  return { facts, language: 'en', questions: dataQuestions() };
}

async function draftWith(reply: FakeReply) {
  const gateway = gatewayAnswering('familyUpdate', reply);
  const result = await draftFamilyUpdate(gateway, input());
  return { result, gateway };
}

describe('draftFamilyUpdate with the fake gateway', () => {
  it('accepts a draft whose numbers are all in the facts, labelled n of n (D07)', async () => {
    const { result, gateway } = await draftWith({ reading: draftOf(ACCEPTED) });
    expect(result).toEqual({
      kind: 'draft',
      lines: ACCEPTED,
      text: ACCEPTED.join('\n'),
      label: 'numbers checked against your plan: 2 of 2',
      numbersChecked: 2,
      source: 'ai',
      answeredBy: 'gemini-fake',
    });
    const text = stableJson(familyUpdate.factsForModel(makeFacts(), 'en', dataQuestions()));
    expect(gateway.calls).toEqual([{ promptId: 'familyUpdate', text }]);
  });

  it('rejects a draft with an invented number and shows the template with the reason', async () => {
    const { result } = await draftWith({ reading: draftOf(INVENTED) });
    if (result.kind !== 'template') throw new Error('expected the template');
    expect(result.reasons).toEqual(['rejected-numbers']);
    expect(result.offendingNumbers.map((number) => number.value)).toEqual([1_700_000]);
    expect(result.unavailable).toBeNull();
    expect(result.template.lines.length).toBeGreaterThan(0);
  });

  it('rejects a draft that leaves out a question the plan must ask', async () => {
    const { result } = await draftWith({ reading: draftOf(['We will keep you posted.']) });
    expect(result).toMatchObject({
      kind: 'template',
      reasons: ['missing-questions'],
      missingQuestionIds: ['guest-count-reconfirmation', 'venue-capacity', 'date-reconfirmation'],
    });
  });

  it.each([
    ['nokey', 'nokey'],
    ['quota', 'quota'],
    ['schema-violation', 'our-bug'],
  ] as const)('shows the template when the call fails (%s)', async (reply, cause) => {
    const { result } = await draftWith(reply);
    expect(result).toMatchObject({
      kind: 'template',
      reasons: ['unavailable'],
      unavailable: cause,
    });
  });
});

describe('the checked draft lives in the reading cache under the facts hash (D08)', () => {
  const reply = (lines: readonly string[]) => () => ({
    reply: { output_text: JSON.stringify(draftOf(lines)), model: 'gemini-3.5-flash-lite' },
  });

  it('is found again by the GET without a model call, whatever the key order of the facts', async () => {
    const live = harness(reply(ACCEPTED));
    await expect(draftFamilyUpdate(live.gateway, input())).resolves.toMatchObject({
      kind: 'draft',
      source: 'ai',
    });
    const { occasion, ...rest } = makeFacts();
    const reordered: MessageFacts = { ...rest, occasion };
    const found = cachedFamilyUpdate(input(reordered), live.cache, live.clock.now());
    expect(found).toMatchObject({ kind: 'draft', source: 'ai-cached', lines: ACCEPTED });
    expect(live.calls).toHaveLength(1);
  });

  it('finds nothing for other facts or another language, so the template is shown', async () => {
    const live = harness(reply(ACCEPTED));
    await draftFamilyUpdate(live.gateway, input());
    const now = live.clock.now();
    expect(cachedFamilyUpdate({ ...input(), language: 'hi' }, live.cache, now)).toBeNull();
    const moved = makeFacts({ daysToEvent: 46 });
    expect(cachedFamilyUpdate(input(moved), live.cache, now)).toBeNull();
  });

  it('caches a rejected draft as a refusal, so asking again spends no call', async () => {
    const live = harness(reply(INVENTED));
    const first = await draftFamilyUpdate(live.gateway, input());
    expect(first).toMatchObject({ kind: 'template', reasons: ['rejected-numbers'] });
    expect(first.kind === 'template' ? first.offendingNumbers : []).toHaveLength(1);

    const second = await draftFamilyUpdate(live.gateway, input());
    expect(second).toMatchObject({ kind: 'template', reasons: ['rejected-numbers'] });
    expect(live.calls).toHaveLength(1);
    expect(cachedFamilyUpdate(input(), live.cache, live.clock.now())).toMatchObject({
      kind: 'template',
      reasons: ['rejected-numbers'],
    });
  });
});
