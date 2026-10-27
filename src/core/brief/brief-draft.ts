// What the brief holds before it is confirmed. The reader path (a brief PendingReading) and the
// form twin (BriefForm) both end up as one BriefDraft plus the answers typed on the page, and
// one resolver (confirm-brief.ts) turns that pair into a Brief. Sharing the resolver is what
// keeps the two paths from drifting apart: the same facts cannot give two different briefs.

import type { BriefForm } from '@/schemas/forms/brief-form';
import { BUDGET_MAX_INR, BUDGET_MIN_INR, type FunctionAnswer } from '@/schemas/plan/brief';
import type { PendingReading } from '@/schemas/plan/state-token';
import {
  MustHave,
  type Category,
  type Diet,
  type FunctionName,
  type GuestNeed,
  type Priority,
  type VenueLimit,
} from '@/schemas/readings/vocabulary';

/** The values a brief reading kept: unbounded integers, so a typo survives to be asked about. */
export type BriefDraft = Extract<PendingReading, { kind: 'brief' }>['values'];

export interface Bounds {
  readonly min: number;
  readonly max: number;
}

// Budget bounds come from the Brief schema itself so the two cannot disagree.
export const BRIEF_BOUNDS = {
  budgetInr: { min: BUDGET_MIN_INR, max: BUDGET_MAX_INR },
  guests: { min: 1, max: 5_000 },
  venueCapacity: { min: 1, max: 10_000 },
} as const satisfies Record<string, Bounds>;

/**
 * What the person typed on the check page or the form. `undefined` means the field was not on
 * the page, so the reading's value stands; a blank string or null means "left empty", which is
 * a question, never a zero. Text stays text because "8 lakh" and "dedh lakh" are legal.
 */
export interface BriefAnswers {
  readonly occasion?: string | null | undefined;
  readonly budget?: string | null | undefined;
  readonly guests?: string | null | undefined;
  readonly eventDate?: string | null | undefined;
  readonly venueCapacity?: string | null | undefined;
  /** Rows the person changed; a row not named here keeps the reading's answer. */
  readonly functions?: Partial<Record<FunctionName, FunctionAnswer>> | undefined;
  readonly priorities?: Partial<Record<Category, Priority>> | undefined;
  readonly mustHaves?: readonly MustHave[] | undefined;
  readonly needs?: readonly GuestNeed[] | undefined;
  readonly diet?: readonly Diet[] | undefined;
  readonly venueLimits?: readonly VenueLimit[] | undefined;
}

export interface BriefInput {
  readonly draft: BriefDraft;
  readonly answers: BriefAnswers;
}

/** Nothing known yet: every required value empty, every optional row "not sure". */
export function emptyDraft(): BriefDraft {
  return {
    occasion: null,
    budgetInr: null,
    guests: null,
    eventDate: null,
    venueCapacity: null,
    functions: {
      haldi: 'unsure',
      mehndi: 'unsure',
      sangeet: 'unsure',
      wedding: 'unsure',
      reception: 'unsure',
    },
    priorities: {
      venue: 'unclear',
      catering: 'unclear',
      decor: 'unclear',
      photo: 'unclear',
      music: 'unclear',
      invites: 'unclear',
      contingency: 'unclear',
    },
    mustHaves: [],
    needs: [],
    diet: [],
    venueLimits: [],
    notes: [],
  };
}

/**
 * The form twin's fields as a draft plus answers. Budget, guests, capacity and date are typed
 * text, so they travel as answers and pass through the same parsing and bounds as a check-page
 * answer; the occasion and the choice rows are already valid by the form schema.
 */
export function inputFromForm(form: BriefForm): BriefInput {
  const draft: BriefDraft = {
    ...emptyDraft(),
    occasion: form.occasion,
    functions: {
      haldi: form.functionHaldi,
      mehndi: form.functionMehndi,
      sangeet: form.functionSangeet,
      wedding: form.functionWedding,
      reception: form.functionReception,
    },
    priorities: {
      venue: form.priorityVenue,
      catering: form.priorityCatering,
      decor: form.priorityDecor,
      photo: form.priorityPhoto,
      music: form.priorityMusic,
      invites: form.priorityInvites,
      contingency: form.priorityContingency,
    },
    // Vocabulary order, not tick order: the form lists wedding must-haves in their own fold, so
    // the order posted differs from before, and it would change the sealed token bytes.
    mustHaves: MustHave.options.filter((each) => form.mustHave.includes(each)),
    needs: form.need,
    diet: form.diet,
    venueLimits: form.venueLimit,
  };
  return {
    draft,
    answers: {
      budget: form.budget,
      guests: form.guests,
      eventDate: form.eventDate,
      venueCapacity: form.venueCapacity,
    },
  };
}
