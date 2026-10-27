import type { ReactElement, ReactNode } from 'react';

import { Amount } from '@/components/money/amount';
import { Icon, type IconName } from '@/components/status/icon';
import type { BriefDraft } from '@/core/brief/brief-draft';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { FieldVerdict, PendingReading } from '@/schemas/plan/state-token';
import {
  Category,
  Diet,
  FunctionName,
  GuestNeed,
  MustHave,
  VenueLimit,
} from '@/schemas/readings/vocabulary';

import { countWords, dateWords } from '../../../_brief/words';

const STATUS_ICON: Readonly<Record<FieldVerdict['status'], IconName>> = {
  verified: 'check',
  unverified: 'triangle',
  unclear: 'circle',
  absent: 'info',
};

interface Shown {
  readonly label: string;
  readonly value: ReactNode;
}

// What a verdict's field name ("budget", "priority.catering", "note.0") stands for in the
// draft: the label and the value as understood, so the row reads "Food: Spend more".
function briefValue(field: string, draft: BriefDraft, lang: Lang): Shown {
  const dict = dictionaryFor(lang);
  const form = dict.form;
  const [head = '', item = ''] = field.split('.');
  switch (head) {
    case 'occasion':
      return {
        label: dict.check.fields.occasion,
        value: draft.occasion === null ? null : form.occasions[draft.occasion],
      };
    case 'budget':
      return {
        label: dict.check.fields.budget,
        value:
          draft.budgetInr === null ? null : (
            <Amount money={{ inr: draft.budgetInr, provenance: 'your-number' }} lang={lang} />
          ),
      };
    case 'guests':
    case 'venueCapacity': {
      const count = head === 'guests' ? draft.guests : draft.venueCapacity;
      return { label: dict.check.fields[head], value: count === null ? null : countWords(count) };
    }
    case 'date':
      return {
        label: dict.check.fields.eventDate,
        value: draft.eventDate === null ? null : dateWords(draft.eventDate, lang),
      };
  }
  return listValue(head, item, draft, lang) ?? { label: dict.check.noteLabel, value: null };
}

function listValue(head: string, item: string, draft: BriefDraft, lang: Lang): Shown | null {
  const form = dictionaryFor(lang).form;
  const fn = FunctionName.safeParse(item);
  if (head === 'function' && fn.success) {
    return {
      label: form.functions[fn.data],
      value: form.functionAnswers[draft.functions[fn.data]],
    };
  }
  const category = Category.safeParse(item);
  if (head === 'priority' && category.success) {
    const level = draft.priorities[category.data];
    return { label: form.categories[category.data], value: form.priorityAnswers[level] };
  }
  const mustHave = MustHave.safeParse(item);
  if (head === 'mustHave' && mustHave.success) {
    return { label: form.mustHavesLegend, value: form.mustHaves[mustHave.data] };
  }
  const need = GuestNeed.safeParse(item);
  if (head === 'need' && need.success) {
    return { label: form.needsLegend, value: form.needs[need.data] };
  }
  const diet = Diet.safeParse(item);
  if (head === 'diet' && diet.success)
    return { label: form.dietLegend, value: form.diet[diet.data] };
  const limit = VenueLimit.safeParse(item);
  if (head === 'venueLimit' && limit.success) {
    return { label: form.venueLimitsLegend, value: form.venueLimits[limit.data] };
  }
  return null;
}

// "Not found in your words" only when the words were not found. A quote that was found but
// whose value is out of range ("0 guests") or whose number it does not spell ("pachpan log")
// says so, because the person can see their own words right above the badge.
export function badgeOf(verdict: FieldVerdict, lang: Lang): string {
  const words = dictionaryFor(lang).check;
  if (verdict.status === 'unverified' && verdict.reason === 'out-of-bounds') {
    return words.foundBut.outOfBounds;
  }
  if (verdict.status === 'unverified' && verdict.reason === 'number-not-in-quote') {
    return words.foundBut.numberNotInQuote;
  }
  return words.status[verdict.status];
}

function shownFor(verdict: FieldVerdict, pending: PendingReading, lang: Lang): Shown {
  return pending.kind === 'brief'
    ? briefValue(verdict.field, pending.values, lang)
    : { label: verdict.field, value: null };
}

/**
 * Every value beside the user's own words, highlighted, and whether code found those words
 * in the text (FR-2). The count above it is computed from these verdicts, never by the model.
 */
export function ReadList({
  pending,
  lang,
}: {
  readonly pending: PendingReading;
  readonly lang: Lang;
}): ReactElement {
  return (
    <ul className="mt-2 divide-y divide-line">
      {pending.fields.map((verdict) => {
        const shown = shownFor(verdict, pending, lang);
        return (
          <li key={verdict.field} className="py-3">
            <p>
              <span className="font-medium">{shown.label}</span>
              {shown.value === null ? null : <>: {shown.value}</>}
            </p>
            {verdict.displayQuote === null ? null : (
              <p className="mt-1">
                <mark className="rounded bg-note-bg px-1 text-foreground">
                  <q>{verdict.displayQuote}</q>
                </mark>
              </p>
            )}
            <p className="mt-1 inline-flex items-center gap-1 text-sm">
              <Icon name={STATUS_ICON[verdict.status]} />
              <span>{badgeOf(verdict, lang)}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
