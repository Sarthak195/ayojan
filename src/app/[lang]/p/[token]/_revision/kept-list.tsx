import type { ReactElement } from 'react';
import { z } from 'zod';

import type { Decision, KeptDecisions } from '@/core/plan/kept';
import { quoteLabel } from '@/core/quotes/quote-wording';
import { dictionaryFor } from '@/i18n/dictionary';
import { FunctionAnswer } from '@/schemas/plan/brief';
import {
  Category,
  Diet,
  FunctionName,
  GuestNeed,
  MustHave,
  Priority,
  VenueLimit,
} from '@/schemas/readings/vocabulary';

import { dateWords } from '../../../_brief/words';
import type { Names } from './names';

const TaskEvent = z.object({ doneOn: z.string().nullable(), notBefore: z.string().nullable() });

function valueOf(decision: Decision): unknown {
  try {
    const parsed: unknown = JSON.parse(decision.value);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * A decision in words. The key is `<kind>:<id>` and the value is canonical JSON (kept.ts), so
 * both are parsed against the closed vocabularies rather than trusted; anything unexpected
 * falls back to the raw id, which valid plans never show.
 */
function decisionText(decision: Decision, names: Names): string {
  const dict = dictionaryFor(names.lang);
  const words = dict.revision.decision;
  const form = dict.form;
  const id = decision.key.slice(decision.kind.length + 1);
  const value = valueOf(decision);
  switch (decision.kind) {
    case 'priority': {
      const category = Category.safeParse(id);
      const level = Priority.safeParse(value);
      if (!category.success || !level.success) return id;
      return words.priority(names.category(category.data), form.priorityAnswers[level.data]);
    }
    case 'mustHave': {
      const item = MustHave.safeParse(id);
      return item.success ? words.mustHave(form.mustHaves[item.data]) : id;
    }
    case 'need': {
      const item = GuestNeed.safeParse(id);
      return item.success ? words.need(form.needs[item.data]) : id;
    }
    case 'diet': {
      const item = Diet.safeParse(id);
      return item.success ? words.diet(form.diet[item.data]) : id;
    }
    case 'venueLimit': {
      const item = VenueLimit.safeParse(id);
      return item.success ? words.venueLimit(form.venueLimits[item.data]) : id;
    }
    case 'function': {
      const name = FunctionName.safeParse(id);
      const answer = FunctionAnswer.safeParse(value);
      if (!name.success || !answer.success) return id;
      return words.function(form.functions[name.data], form.functionAnswers[answer.data]);
    }
    case 'booking': {
      const category = Category.safeParse(id);
      return words.booking(category.success ? names.category(category.data) : id);
    }
    case 'quote': {
      const { vendor } = decision;
      const label =
        vendor?.kind === 'quote'
          ? quoteLabel({ category: vendor.category, id: vendor.quoteId }, names.lang)
          : id;
      return words.quote(label);
    }
    case 'taskEvent': {
      const event = TaskEvent.safeParse(value);
      const task = names.task(id);
      if (event.success && event.data.doneOn === null && event.data.notBefore !== null) {
        return words.taskDelayed(task, dateWords(event.data.notBefore, names.lang));
      }
      return words.taskDone(task);
    }
    case 'lever':
      return words.lever(names.lever(id));
  }
}

function Group({
  id,
  heading,
  intro,
  decisions,
  names,
}: {
  readonly id: string;
  readonly heading: string;
  readonly intro: string;
  readonly decisions: readonly Decision[];
  readonly names: Names;
}): ReactElement {
  const words = dictionaryFor(names.lang).revision;
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-8">
      <h2 id={`${id}-heading`} className="text-xl font-semibold">
        {heading}
      </h2>
      {intro === '' ? null : <p className="text-sm text-muted">{intro}</p>}
      {decisions.length === 0 ? (
        <p className="mt-1">{words.none}</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-6">
          {decisions.map((decision) => (
            <li key={decision.key}>{decisionText(decision, names)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "Kept" and "Kept, ask again" (FR-26, D29): the counter above counts exactly these two lists. */
export function KeptLists({
  kept,
  names,
}: {
  readonly kept: KeptDecisions;
  readonly names: Names;
}): ReactElement {
  const words = dictionaryFor(names.lang).revision;
  return (
    <>
      <Group
        id="kept"
        heading={words.keptHeading}
        intro={words.keptIntro}
        decisions={kept.kept}
        names={names}
      />
      <Group
        id="kept-ask-again"
        heading={words.askAgainHeading}
        intro={words.askAgainIntro}
        decisions={kept.keptAskAgain}
        names={names}
      />
      {kept.changed.length === 0 ? null : (
        <Group
          id="changed"
          heading={words.changedHeading}
          intro=""
          decisions={kept.changed}
          names={names}
        />
      )}
    </>
  );
}
