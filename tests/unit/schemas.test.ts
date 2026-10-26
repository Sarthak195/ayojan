import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { BriefForm } from '@/schemas/forms/brief-form';
import { ChangeForm } from '@/schemas/forms/change-form';
import { CheckConfirm } from '@/schemas/forms/check-confirm';
import { LeverChoice } from '@/schemas/forms/lever-choice';
import { QuoteForm } from '@/schemas/forms/quote-form';
import { TaskEvent } from '@/schemas/forms/task-event';
import { TaskId } from '@/schemas/generated/ids';
import { Brief } from '@/schemas/plan/brief';
import { Op } from '@/schemas/plan/op';
import { ShortText, toShortText, utf8ByteLength } from '@/schemas/plan/short-text';
import { StateToken } from '@/schemas/plan/state-token';
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

const brief = {
  occasion: 'wedding',
  budgetInr: 800_000,
  guests: 200,
  eventDate: '2027-02-26',
  venueCapacity: null,
  functions: { haldi: 'yes', mehndi: 'yes', sangeet: 'unsure', wedding: 'yes', reception: 'no' },
  priorities: {
    venue: 'standard',
    catering: 'more',
    decor: 'save',
    photo: 'standard',
    music: 'standard',
    invites: 'standard',
    contingency: 'standard',
  },
  mustHaves: ['dhol'],
  needs: ['wheelchair'],
  diet: [],
  venueLimits: [],
  notes: ['DJ chahiye'],
};
const readBy = { source: 'form', model: null, matched: 0, total: 0 };
const briefOp = { kind: 'briefConfirmed', brief, readBy };

describe('short-text', () => {
  it('accepts 80 bytes and refuses 81, counting bytes rather than characters', () => {
    expect(ShortText.safeParse('a'.repeat(80)).success).toBe(true);
    expect(ShortText.safeParse('a'.repeat(81)).success).toBe(false);
    // 26 Devanagari letters are 78 bytes; the 27th makes 81, though it is only 27 characters.
    expect(ShortText.safeParse('क'.repeat(26)).success).toBe(true);
    expect(ShortText.safeParse('क'.repeat(27)).success).toBe(false);
  });

  it('cuts on a code-point boundary, never splitting a character or an emoji', () => {
    expect(utf8ByteLength(toShortText('क'.repeat(40)))).toBe(78);
    const emoji = String.fromCodePoint(0x1f600);
    expect(toShortText(`${'a'.repeat(78)}${emoji}b`)).toBe('a'.repeat(78));
    expect(ShortText.safeParse(toShortText('लाख '.repeat(40))).success).toBe(true);
    expect(toShortText('short')).toBe('short');
  });
});

describe('plan-state', () => {
  it('parses a minimal state with one confirmed brief', () => {
    expect(StateToken.safeParse({ schema: 1, ops: [briefOp] }).success).toBe(true);
  });

  it('refuses a task id that the data does not define, at parse time (NFR-CQ-7)', () => {
    const done = { kind: 'taskDone', on: '2026-11-02', amountInr: 180_000, capacity: 220 };
    expect(Op.safeParse({ ...done, taskId: 'book-venue' }).success).toBe(true);
    expect(Op.safeParse({ ...done, taskId: 'book-astrologer' }).success).toBe(false);
    expect(TaskId.options).toContain('book-venue');
  });

  it('refuses a lever id that the data does not define', () => {
    const op = { kind: 'leversApplied', raiseBudgetInr: null };
    expect(Op.safeParse({ ...op, leverIds: ['simpler-decor'] }).success).toBe(true);
    expect(Op.safeParse({ ...op, leverIds: ['switch-quote'] }).success).toBe(false);
  });

  it('caps the ops at 40 and refuses another schema version', () => {
    const ops = Array.from({ length: 41 }, () => briefOp);
    expect(StateToken.safeParse({ schema: 1, ops: ops.slice(0, 40) }).success).toBe(true);
    expect(StateToken.safeParse({ schema: 1, ops }).success).toBe(false);
    expect(StateToken.safeParse({ schema: 2, ops: [briefOp] }).success).toBe(false);
  });

  it('needs an explicit answer for every priority, so nothing defaults', () => {
    const sixPriorities = Object.fromEntries(
      Object.entries(brief.priorities).filter(([category]) => category !== 'decor'),
    );
    expect(Brief.safeParse({ ...brief, priorities: sixPriorities }).success).toBe(false);
  });

  it('keeps a named occasion such as puja, and refuses one outside the list (D38)', () => {
    expect(Brief.safeParse({ ...brief, occasion: 'puja' }).success).toBe(true);
    expect(Brief.safeParse({ ...brief, occasion: 'unclear' }).success).toBe(false);
    expect(Brief.safeParse({ ...brief, occasion: 'graduation' }).success).toBe(false);
    const reading = (value: string) =>
      BriefReading.shape.occasion.safeParse({ value, quote: 'Papa ka 60th birthday' }).success;
    expect(reading('birthday')).toBe(true);
    expect(reading('unclear')).toBe(true);
    expect(reading('graduation')).toBe(false);
  });

  it('bounds the confirmed budget at Rs 5,000 to Rs 10 crore (D15)', () => {
    expect(Brief.safeParse({ ...brief, budgetInr: 5_000 }).success).toBe(true);
    expect(Brief.safeParse({ ...brief, budgetInr: 4_999 }).success).toBe(false);
    expect(Brief.safeParse({ ...brief, budgetInr: 100_000_001 }).success).toBe(false);
  });

  it('refuses a change source over 80 bytes and a calendar date that does not exist', () => {
    const change = {
      kind: 'changeConfirmed',
      guests: 250,
      budgetInr: 750_000,
      eventDate: '2027-02-12',
      reallocate: null,
      priorities: null,
      sources: ['50 more guests'],
      readBy,
    };
    expect(Op.safeParse(change).success).toBe(true);
    expect(Op.safeParse({ ...change, sources: ['क'.repeat(27)] }).success).toBe(false);
    expect(Op.safeParse({ ...change, eventDate: '2027-02-30' }).success).toBe(false);
  });

  it('keeps an out-of-range value in a pending reading so it can become a question', () => {
    const pending = {
      kind: 'brief',
      values: { ...brief, guests: 0, budgetInr: 4_999, eventDate: '2020-03-12' },
      fields: [{ field: 'guests', status: 'verified', reason: null, displayQuote: '0 log' }],
      readBy: { source: 'ai', model: 'gemini-3.5-flash-lite', matched: 1, total: 1 },
    };
    expect(StateToken.safeParse({ schema: 1, ops: [], pending }).success).toBe(true);
  });
});

describe('forms', () => {
  const token = 'abc_DEF-123';

  it('accepts out-of-range values as text, so they become questions and not a 400', () => {
    const form = {
      occasion: 'wedding',
      budget: '8 lakh',
      guests: '0',
      eventDate: '2020-03-12',
      venueCapacity: '',
      functionHaldi: 'yes',
      functionMehndi: 'no',
      functionSangeet: 'unsure',
      functionWedding: 'yes',
      functionReception: 'no',
      priorityVenue: 'standard',
      priorityCatering: 'more',
      priorityDecor: 'save',
      priorityPhoto: 'standard',
      priorityMusic: 'standard',
      priorityInvites: 'standard',
      priorityContingency: 'standard',
      mustHave: 'dhol',
    };
    const parsed = BriefForm.safeParse(form);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.mustHave).toEqual(['dhol']);
    expect(parsed.data?.need).toEqual([]);
    expect(BriefForm.safeParse({ ...form, surprise: 'x' }).success).toBe(false);
    expect(BriefForm.safeParse({ ...form, guests: ['1', '2'] }).success).toBe(false);
  });

  it.each(['0', '61', '1.5', '-3', ''])('refuses a delay of "%s" days (400)', (days) => {
    const event = { token, taskId: 'book-decorator', event: 'delayed', days };
    expect(TaskEvent.safeParse(event).success).toBe(false);
  });

  it('turns a delay into a number and leaves an unknown task id to the route (422)', () => {
    const event = { token, taskId: 'book-astrologer', event: 'delayed', days: '10' };
    const parsed = TaskEvent.safeParse(event);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ days: 10 });
  });

  it('refuses a non-integer amount on a booking', () => {
    const done = { token, taskId: 'book-venue', event: 'done', capacity: '220' };
    expect(TaskEvent.safeParse({ ...done, amountInr: '180000' }).success).toBe(true);
    expect(TaskEvent.safeParse({ ...done, amountInr: '1.5' }).success).toBe(false);
  });

  it('reads one ticked lever as a list and refuses unknown levers', () => {
    const parsed = LeverChoice.safeParse({ token, intent: 'preview', lever: 'simpler-decor' });
    expect(parsed.data).toMatchObject({ lever: ['simpler-decor'], showAnyway: [] });
    const unknown = { token, intent: 'apply', lever: 'trim-guests' };
    expect(LeverChoice.safeParse(unknown).success).toBe(false);
  });

  it('lets every change field be empty, meaning no change', () => {
    const empty = Object.fromEntries(
      Object.keys(ChangeForm.shape).map((key) => [key, key === 'token' ? token : '']),
    );
    expect(ChangeForm.safeParse(empty).success).toBe(true);
    expect(CheckConfirm.safeParse({ token, intent: 'confirm' }).success).toBe(true);
    expect(QuoteForm.shape.tax.options).toContain('extraRateUnstated');
  });
});
