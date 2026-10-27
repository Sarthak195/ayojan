import { describe, expect, it } from 'vitest';

import { BRIEF_BOUNDS, emptyDraft, inputFromForm } from '@/core/brief/brief-draft';
import { resolveBrief, resolveFormBrief } from '@/core/brief/confirm-brief';
import { Brief } from '@/schemas/plan/brief';
import type { BriefForm } from '@/schemas/forms/brief-form';

import { asked, CONTEXT, settle } from './brief-fixture';

const FORM: BriefForm = {
  occasion: 'wedding',
  budget: '8 lakh',
  guests: '200',
  eventDate: '2027-02-26',
  venueCapacity: '',
  functionHaldi: 'unsure',
  functionMehndi: 'unsure',
  functionSangeet: 'unsure',
  functionWedding: 'unsure',
  functionReception: 'unsure',
  priorityVenue: 'standard',
  priorityCatering: 'standard',
  priorityDecor: 'standard',
  priorityPhoto: 'standard',
  priorityMusic: 'standard',
  priorityInvites: 'standard',
  priorityContingency: 'standard',
  mustHave: [],
  need: [],
  diet: [],
  venueLimit: [],
};

describe('brief draft from a reading (FR-3, FR-4)', () => {
  it('confirms a fully read brief unchanged and passes the Brief schema', () => {
    const result = settle();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Brief.parse(result.brief)).toEqual(result.brief);
      expect(result.brief.budgetInr).toBe(800_000);
      expect(result.brief.venueCapacity).toBeNull();
    }
  });

  it.each([
    ['guests', 0],
    ['guests', -1],
    ['guests', 5_001],
    ['budgetInr', 0],
    ['budgetInr', 4_999],
    ['budgetInr', 100_000_001],
    ['budgetInr', -800_000],
    ['venueCapacity', 0],
    ['venueCapacity', 10_001],
  ] as const)('a read %s of %i is a question that keeps the value to show', (key, value) => {
    const result = settle({ [key]: value });
    const field = key === 'budgetInr' ? 'budget' : key;
    expect(asked(result)).toEqual([{ field, reason: 'out-of-range' }]);
    expect(result.draft[key]).toBe(value);
  });

  it.each([
    ['guests', 1],
    ['guests', 5_000],
    ['budgetInr', BRIEF_BOUNDS.budgetInr.min],
    ['budgetInr', 100_000_000],
    ['venueCapacity', 1],
    ['venueCapacity', 10_000],
  ] as const)('%s at the edge value %i is accepted', (key, value) => {
    expect(settle({ [key]: value }).ok).toBe(true);
  });

  it('asks for every required value when the reading found none, in a stable order', () => {
    const result = resolveBrief({ draft: emptyDraft(), answers: {} }, CONTEXT);
    expect(asked(result)).toEqual([
      { field: 'occasion', reason: 'missing' },
      { field: 'budget', reason: 'missing' },
      { field: 'guests', reason: 'missing' },
      { field: 'eventDate', reason: 'missing' },
    ]);
  });

  it('leaves functions, priorities and lists "not sure" without asking, and keeps unclear as unclear', () => {
    const result = settle();
    expect(result.ok && result.brief.priorities.venue).toBe('unclear');
    expect(result.ok && result.brief.functions.sangeet).toBe('unsure');
    expect(result.ok && result.brief.mustHaves).toEqual([]);
  });

  it('keeps notes as noted text and never asks about them', () => {
    const result = settle({ notes: ['DJ chahiye'] });
    expect(result.ok && result.brief.notes).toEqual(['DJ chahiye']);
  });

  it('keeps one answer per list item', () => {
    const result = settle({ diet: ['jain', 'jain', 'vegOnly'] });
    expect(result.ok && result.brief.diet).toEqual(['jain', 'vegOnly']);
  });
});

describe('one resolver for the reader and the form twin (FR-5)', () => {
  it('gives the same Brief from the same facts, whichever path read them', () => {
    const input = inputFromForm(FORM);
    const read = resolveBrief(
      {
        draft: { ...input.draft, budgetInr: 800_000, guests: 200, eventDate: '2027-02-26' },
        answers: {},
      },
      CONTEXT,
    );
    const typed = resolveFormBrief(FORM, CONTEXT);
    expect(read).toEqual(typed);
  });

  it('keeps must-haves in vocabulary order however the two form groups are posted', () => {
    // The wedding-only fold comes first in the document, so its ticks are posted first.
    const posted: BriefForm['mustHave'] = ['choreographer', 'mehndiArtist', 'liveCounter', 'dhol'];
    const { draft } = inputFromForm({ ...FORM, mustHave: posted });
    expect(draft.mustHaves).toEqual(['dhol', 'mehndiArtist', 'liveCounter', 'choreographer']);
    const brief = resolveFormBrief({ ...FORM, mustHave: ['mehndiArtist', 'dhol'] }, CONTEXT);
    expect(brief.ok && brief.brief.mustHaves).toEqual(['dhol', 'mehndiArtist']);
  });

  it('turns an invalid form field into a question and keeps the valid ones', () => {
    const result = resolveFormBrief({ ...FORM, guests: '0', budget: 'dedh lakh' }, CONTEXT);
    expect(asked(result)).toEqual([{ field: 'guests', reason: 'out-of-range' }]);
    expect(result.draft.budgetInr).toBe(150_000);
    expect(result.draft.eventDate).toBe('2027-02-26');
    expect(result.draft.occasion).toBe('wedding');
  });

  it('asks when a required form field is left blank', () => {
    const result = resolveFormBrief({ ...FORM, budget: '', eventDate: null }, CONTEXT);
    expect(asked(result)).toEqual([
      { field: 'budget', reason: 'missing' },
      { field: 'eventDate', reason: 'missing' },
    ]);
  });

  it('keeps venue capacity optional on the form', () => {
    const result = resolveFormBrief({ ...FORM, venueCapacity: '220' }, CONTEXT);
    expect(result.ok && result.brief.venueCapacity).toBe(220);
  });
});
