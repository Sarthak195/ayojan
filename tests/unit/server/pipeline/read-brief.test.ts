import { describe, expect, it } from 'vitest';

import { canonicalise } from '@/core/grounding/canonical-text';
import type { BriefReading } from '@/schemas/readings/brief-reading';
import { readBrief } from '@/server/pipeline/read-brief';
import type { ReadingOutcome } from '@/server/pipeline/reading-outcome';
import { readingSourceLabel } from '@/server/pipeline/reading-outcome';

import type { FakeReply } from '../../../fakes/llm-gateway';
import {
  HINGLISH,
  HINGLISH_READING,
  NO_EXAMPLES,
  TODAY,
  bookWith,
  briefReading,
  gatewayAnswering,
} from './readings';

async function read(text: string, reply: FakeReply, examples = NO_EXAMPLES) {
  const gateway = gatewayAnswering('brief', reply);
  const outcome = await readBrief({ gateway, examples }, { text, today: TODAY });
  return { outcome, gateway };
}

function pendingOf(outcome: ReadingOutcome) {
  if (outcome.kind !== 'check' || outcome.pending.kind !== 'brief') {
    throw new Error(`expected a brief check page, got ${outcome.kind}`);
  }
  return outcome.pending;
}

async function readReading(text: string, reading: BriefReading) {
  return pendingOf((await read(text, { reading })).outcome);
}

const verdictOf = (pending: ReturnType<typeof pendingOf>, field: string) =>
  pending.fields.find((verdict) => verdict.field === field);

describe('readBrief on the Hinglish sample (spec 5.1)', () => {
  it('reads every value beside its own words and asks for the vague date', async () => {
    const pending = await readReading(HINGLISH, HINGLISH_READING);
    expect(pending.values).toMatchObject({
      occasion: 'wedding',
      budgetInr: 800_000,
      guests: 200,
      eventDate: null,
      venueCapacity: null,
      functions: {
        haldi: 'yes',
        mehndi: 'yes',
        wedding: 'yes',
        sangeet: 'unsure',
        reception: 'unsure',
      },
      mustHaves: ['dhol'],
      needs: ['wheelchair'],
    });
    expect(pending.values.priorities).toMatchObject({
      catering: 'more',
      decor: 'save',
      venue: 'unclear',
    });
    expect(verdictOf(pending, 'date')).toEqual({
      field: 'date',
      status: 'unclear',
      reason: null,
      displayQuote: 'Feb end mein',
    });
    expect(verdictOf(pending, 'budget')?.displayQuote).toBe('budget 8 lakh');
    expect(pending.readBy).toEqual({ source: 'ai', model: 'gemini-fake', matched: 10, total: 10 });
  });

  it('sends only the canonical text to the gateway', async () => {
    const pasted = `[26/10/26, 9:41 pm] Mausi: ${HINGLISH}  🎉`;
    const { gateway } = await read(pasted, { reading: HINGLISH_READING });
    expect(gateway.calls).toEqual([{ promptId: 'brief', text: canonicalise(pasted).text }]);
  });
});

describe('readBrief turns doubtful values into questions, never defaults', () => {
  it('a quote that is not in the text is unverified and its value is dropped', async () => {
    const pending = await readReading(HINGLISH, {
      ...HINGLISH_READING,
      budget: { presence: 'present', amountInr: 800_000, quote: 'budget is eight lakh rupees' },
    });
    expect(pending.values.budgetInr).toBeNull();
    expect(verdictOf(pending, 'budget')).toMatchObject({
      status: 'unverified',
      reason: 'quote-not-found',
    });
    expect(pending.readBy).toMatchObject({ matched: 9, total: 10 });
  });

  it('a number its quote does not spell is unverified', async () => {
    const pending = await readReading(
      'budget thoda kam rakhna, 200 log',
      briefReading({
        budget: { presence: 'present', amountInr: 800_000, quote: 'budget thoda kam' },
      }),
    );
    expect(pending.values.budgetInr).toBeNull();
    expect(verdictOf(pending, 'budget')?.reason).toBe('number-not-in-quote');
  });

  it('reads a quoted budget the model left without a number, as the form field would', async () => {
    const pending = await readReading(
      'Anniversary dinner, budget dedh lakh, 5 December 2026.',
      briefReading({ budget: { presence: 'present', amountInr: null, quote: 'budget dedh lakh' } }),
    );
    expect(pending.values.budgetInr).toBe(150_000);
    expect(verdictOf(pending, 'budget')).toMatchObject({ status: 'verified', reason: null });
  });

  it('still asks for a budget the model called unclear, even when its words hold one figure', async () => {
    const pending = await readReading(
      'budget dhai lakh ke aas paas',
      briefReading({
        budget: { presence: 'unclear', amountInr: null, quote: 'dhai lakh ke aas paas' },
      }),
    );
    expect(pending.values.budgetInr).toBeNull();
    expect(verdictOf(pending, 'budget')?.status).toBe('unclear');
  });

  it('keeps 0 guests the user wrote as an out-of-bounds question (FR-4)', async () => {
    const pending = await readReading(
      'budget 5 lakh, 0 log, 10 March 2027',
      briefReading({ guests: { presence: 'present', count: 0, quote: '0 log' } }),
    );
    expect(pending.values.guests).toBe(0);
    expect(verdictOf(pending, 'guests')).toMatchObject({
      status: 'unverified',
      reason: 'out-of-bounds',
    });
  });

  it('drops an out-of-bounds number the quote does not spell', async () => {
    const pending = await readReading(
      'budget 8 lakh hai',
      briefReading({ budget: { presence: 'present', amountInr: 200, quote: 'budget 8 lakh' } }),
    );
    expect(pending.values.budgetInr).toBeNull();
  });

  it('keeps a past date with its reason, and resolves a date with no year', async () => {
    const past = await readReading(
      'shaadi 12 March 2020 ko',
      briefReading({
        date: { presence: 'present', day: 12, month: 3, year: 2020, quote: '12 March 2020' },
      }),
    );
    expect(past.values.eventDate).toBe('2020-03-12');
    expect(verdictOf(past, 'date')).toMatchObject({
      status: 'unverified',
      reason: 'out-of-bounds',
    });

    const birthday = await readReading(
      'Papa ka 60th birthday, 2 lakh, 80 log, 12 Dec',
      briefReading({
        date: { presence: 'present', day: 12, month: 12, year: null, quote: '12 Dec' },
      }),
    );
    expect(birthday.values.eventDate).toBe('2026-12-12');
    expect(verdictOf(birthday, 'date')?.status).toBe('verified');
  });

  it('makes a 161-character quote one unverified field and keeps the rest (D36)', async () => {
    const long = `${'a'.repeat(150)} budget 8 lakh`;
    const pending = await readReading(
      `${long} and 200 log`,
      briefReading({
        budget: {
          presence: 'present',
          amountInr: 800_000,
          quote: `${'a'.repeat(148)} budget 8 lakh`,
        },
        guests: { presence: 'present', count: 200, quote: '200 log' },
      }),
    );
    expect(verdictOf(pending, 'budget')).toMatchObject({
      status: 'unverified',
      reason: 'quote-too-long',
    });
    expect(pending.values.guests).toBe(200);
  });

  it('verifies a function the family said no to before it becomes "no"', async () => {
    const pending = await readReading(
      'sangeet nahi karenge',
      briefReading({
        functions: [{ name: 'sangeet', presence: 'absent', quote: 'sangeet nahi karenge' }],
      }),
    );
    expect(pending.values.functions.sangeet).toBe('no');
  });

  it('keeps at most 16 display quotes, questions before matched values', async () => {
    const text = 'a b c d e f g h i j k l m n o p q r s t u v w x y z budget 8 lakh, 200 log';
    const pending = await readReading(
      text,
      briefReading({
        budget: { presence: 'present', amountInr: 800_000, quote: 'budget 8 lakh' },
        guests: { presence: 'present', count: 200, quote: 'not in the text' },
        functions: (['haldi', 'mehndi', 'sangeet', 'wedding', 'reception'] as const).map(
          (name) => ({
            name,
            presence: 'present' as const,
            quote: 'budget 8 lakh',
          }),
        ),
        priorities: (
          ['venue', 'catering', 'decor', 'photo', 'music', 'invites', 'contingency'] as const
        ).map((category) => ({ category, level: 'more' as const, quote: 'budget 8 lakh' })),
        mustHaves: [{ item: 'dhol', quote: 'missing words here' }],
        diet: [{ item: 'jain', presence: 'present', quote: 'budget 8 lakh' }],
      }),
    );
    expect(pending.fields).toHaveLength(16);
    expect(verdictOf(pending, 'mustHave.dhol')?.status).toBe('unverified');
    expect(verdictOf(pending, 'guests')?.status).toBe('unverified');
    expect(pending.readBy).toMatchObject({ matched: 14, total: 16 });
  });
});

describe('readBrief when the model cannot be used', () => {
  it.each([
    ['nokey', 'nokey', 'nokey'],
    ['quota', 'quota', 'quota'],
    ['timeout', 'timeout', 'timeout'],
    ['schema-violation', 'timeout', 'our-bug'],
  ] as const)('%s sends the user to the form twin', async (reply, why, cause) => {
    const { outcome } = await read(HINGLISH, reply);
    expect(outcome).toEqual({ kind: 'form', why, cause });
  });

  it('serves the recording for the exact sample text above the reserve (D18)', async () => {
    const examples = bookWith('brief', HINGLISH, HINGLISH_READING);
    const { outcome, gateway } = await read(`  ${HINGLISH}\n`, 'quota', examples);
    const pending = pendingOf(outcome);
    expect(pending.readBy).toEqual({
      source: 'example',
      model: 'gemini-3.5-flash-lite',
      matched: 10,
      total: 10,
    });
    expect(outcome.kind === 'check' ? outcome.recordedOn : null).toBe('2026-10-27');
    expect(readingSourceLabel(pending.readBy, '2026-10-27')).toBe(
      'Example reading, recorded on 2026-10-27; your own words are read live',
    );
    expect(gateway.calls).toHaveLength(1);
  });

  it('still says nokey for the sample text on a keyless server', async () => {
    const examples = bookWith('brief', HINGLISH, HINGLISH_READING);
    const { outcome } = await read(HINGLISH, 'nokey', examples);
    expect(outcome).toEqual({ kind: 'form', why: 'nokey', cause: 'nokey' });
  });

  it('reads text the user typed live even when it is close to the sample', async () => {
    const examples = bookWith('brief', HINGLISH, HINGLISH_READING);
    const { outcome } = await read(`${HINGLISH} Mausi bhi aayengi.`, 'quota', examples);
    expect(outcome).toEqual({ kind: 'form', why: 'quota', cause: 'quota' });
  });
});
