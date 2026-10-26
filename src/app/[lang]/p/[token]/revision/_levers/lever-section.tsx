import 'server-only';

import type { ReactElement } from 'react';

import { PostForm, SubmitButton } from '@/components/form/post-form';
import { RunningTotal } from '@/components/islands/running-total.client';
import { Amount } from '@/components/money/amount';
import { ProvenanceBadge } from '@/components/money/provenance-badge';
import type { IsoDate } from '@/core/calendar/day-number';
import { runningLineSentence } from '@/core/levers/running-line';
import type { PlanData } from '@/core/plan/plan-data';
import type { PlanView } from '@/core/plan/plan-view';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import { LeverId } from '@/schemas/generated/ids';
import type { Op } from '@/schemas/plan/op';

import { LeverRow } from './lever-row';
import {
  candidateOp,
  checkTicked,
  chosenOptions,
  previewOf,
  runningTable,
  tickable,
  type LeverPreview,
} from './lever-model';

const FORM_ID = 'lever-form';

/**
 * The lever ids of a Recalculate 303 (`?sel=`). Anything that is not a known id, or a list
 * that no longer passes the plan's checks, reads as nothing ticked rather than an error.
 */
export function selectionOf(
  query: Readonly<Record<string, string | string[] | undefined>>,
): string[] {
  const raw = query.sel;
  if (typeof raw !== 'string' || raw === '') return [];
  const ids = raw.split(',');
  // Each lever once, at most every lever there is: a repeated id cannot make the checks below
  // do more work than a full list.
  return ids.every((id) => LeverId.safeParse(id).success)
    ? [...new Set(ids)].slice(0, LeverId.options.length)
    : [];
}

export interface LeverSectionProps {
  readonly lang: Lang;
  readonly token: string;
  readonly view: PlanView;
  readonly ops: readonly Op[];
  readonly data: PlanData;
  readonly today: IsoDate;
  /** From `selectionOf`; the POST already proved any refused id had "Show anyway" ticked. */
  readonly selection: readonly string[];
}

interface Preview {
  readonly fresh: readonly string[];
  readonly result: LeverPreview | null;
}

function previewFor(props: LeverSectionProps): Preview {
  const { view, ops, data, today, lang, selection } = props;
  const checked = checkTicked(view.current, selection, selection);
  const fresh = checked.ok ? checked.fresh : [];
  const op = candidateOp(ops, view, checked.ok ? checked.fresh : [], data, today);
  if (!op.ok) return { fresh: [], result: null };
  const result = previewOf(ops, view, op.value, data, today, lang);
  return { fresh, result: result.ok ? result.value : null };
}

/**
 * Close the gap (spec 6.6, C7): every lever with its saving, consequence and provenance;
 * refused levers keep their saving behind "Show anyway"; blocked ones say why. Recalculate is
 * the no-JavaScript path through the fold, and the island follows the boxes with the server's
 * own sentences. Nothing is ticked on first render (FR-32).
 */
export function LeverSection(props: LeverSectionProps): ReactElement {
  const { lang, token, view, data } = props;
  const dict = dictionaryFor(lang);
  const words = dict.levers;
  const { current } = view;
  const chosen = chosenOptions(current);
  const open = current.money.options.filter((option) => !chosen.includes(option));
  const { fresh, result } = previewFor(props);
  const sentence = runningLineSentence(
    result?.line ?? {
      kind: current.headline.gap.inr > 0 ? 'over' : 'under',
      saves: { inr: 0, provenance: 'computed' },
      remaining: { inr: Math.abs(current.headline.gap.inr), provenance: 'computed' },
    },
    lang,
  );
  const table = runningTable(current, data, lang);
  const refusedIds = open
    .filter((option) => option.status === 'refused')
    .map((option) => option.id);
  const statusWords = dict.common.status;
  return (
    <section id="levers" aria-labelledby="levers-heading" className="mt-8">
      <h2 id="levers-heading" className="text-xl font-semibold">
        {words.heading}
      </h2>
      {current.headline.gap.inr > 0 ? (
        <p className="mt-2">
          {words.overBy} <Amount money={current.headline.gap} lang={lang} />
        </p>
      ) : null}
      {current.money.options.length === 0 ? <p className="mt-2">{words.withinBudget}</p> : null}
      {chosen.length === 0 ? null : (
        <div className="mt-4">
          <h3 className="font-semibold">{words.chosenHeading}</h3>
          <ul className="mt-1 list-disc pl-6">
            {chosen.map((option) => {
              const line = current.money.applied.find((each) => each.id === option.id);
              return (
                <li key={option.id}>
                  {option.label[lang]}
                  {line === undefined ? null : (
                    <>
                      {': '}
                      <Amount
                        money={line.effect}
                        lang={lang}
                        percent={option.percent ?? undefined}
                      />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-sm text-muted">{words.chosenNote}</p>
        </div>
      )}
      {open.length === 0 ? null : (
        <PostForm lang={lang} route="levers" token={token} id={FORM_ID}>
          <fieldset className="mt-4">
            <legend className="font-medium">{words.legend}</legend>
            <ul className="divide-y divide-line">
              {open.map((option) => (
                <LeverRow
                  key={option.id}
                  option={option}
                  lang={lang}
                  ticked={fresh.includes(option.id)}
                  extra={result?.cleared
                    .filter(
                      (task) =>
                        fresh.includes(option.id) && option.fasterAlternativeFor === task.taskId,
                    )
                    .map((task) => (
                      <p key={task.taskId} className="mt-1">
                        {words.alsoClears(task.name, statusWords[task.before])}
                      </p>
                    ))}
                />
              ))}
            </ul>
          </fieldset>
          <RunningTotal
            id="running-line"
            formId={FORM_ID}
            table={table ?? {}}
            order={tickable(current).map((option) => option.id)}
            needsShowAnyway={refusedIds}
            initial={sentence}
          />
          {/* Both figures in the line are arithmetic over the plan (spec 7). */}
          <ProvenanceBadge provenance="computed" lang={lang} />
          <p className="text-sm text-muted">
            {fresh.length > 0 ? words.previewNote : words.nothingTicked}
          </p>
          {result?.exhausted === true ? (
            <p className="mt-2 font-medium">{words.exhausted}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <SubmitButton
              name="intent"
              value="preview"
              variant="secondary"
              describedBy="recalculate-hint"
            >
              {words.recalculate}
            </SubmitButton>
            <SubmitButton name="intent" value="apply">
              {words.apply}
            </SubmitButton>
          </div>
          <p id="recalculate-hint" className="mt-2 text-sm text-muted">
            {words.recalculateHint}
          </p>
        </PostForm>
      )}
    </section>
  );
}
