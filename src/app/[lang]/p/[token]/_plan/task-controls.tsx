import type { ReactElement } from 'react';

import { TextField } from '@/components/form/fields';
import { PostForm, SubmitButton } from '@/components/form/post-form';
import { DISCLOSURE_GROUP, DisclosureMarker, BUTTON_SUMMARY } from '@/components/layout/disclosure';
import type { ScheduledTask } from '@/core/timeline/schedule-types';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import { MAX_DELAY_DAYS } from '@/schemas/forms/task-event';

import type { CategoryLabel } from '../_change/category-labels';

/** The id of the element holding a task's name, which each control's button is described by. */
export function taskNameId(task: ScheduledTask): string {
  return `task-${task.id}-name`;
}

/**
 * A button's visible word, and its accessible name with the task in one string: the buttons
 * repeat for every task, so each name carries the task to tell them apart. `sr-only` is
 * absolutely positioned, so name computation treats it as a block and puts a space before a
 * separate ": task", which a screen reader reads as "Save : Book the venue".
 */
function Named({ label, task }: { readonly label: string; readonly task: string }): ReactElement {
  return (
    <>
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{`${label}: ${task}`}</span>
    </>
  );
}

const INPUT =
  'block min-h-11 w-24 rounded border border-field-line bg-background px-3 py-2 text-base text-foreground';

/**
 * Mark done and Delayed by N days for one open task (spec 5.6). Two plain forms, because the
 * two events post different fields and the schema refuses any field the event does not use.
 * Only a booking task asks for an amount, and only the venue booking for a capacity, the same
 * rule the fold applies (D10).
 */
export function TaskControls({
  task,
  lang,
  token,
  labelOf,
}: {
  readonly task: ScheduledTask;
  readonly lang: Lang;
  readonly token: string;
  readonly labelOf: CategoryLabel;
}): ReactElement | null {
  if (task.done) return null;
  const dict = dictionaryFor(lang);
  const words = dict.tasks;
  const name = <span className="sr-only">{task[lang]}: </span>;
  const describedBy = taskNameId(task);
  const daysId = `task-${task.id}-days`;
  return (
    <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
      <PostForm lang={lang} route="task" token={token}>
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="event" value="done" />
        {task.books === null ? (
          <SubmitButton variant="secondary" describedBy={describedBy}>
            <Named label={words.markDone} task={task[lang]} />
          </SubmitButton>
        ) : (
          <details className={DISCLOSURE_GROUP}>
            <summary className={BUTTON_SUMMARY}>
              <Named label={words.markDone} task={task[lang]} />
              <DisclosureMarker />
            </summary>
            <TextField
              name="amountInr"
              id={`task-${task.id}-amount`}
              label={
                <>
                  {name}
                  {words.amountLabel}
                </>
              }
              inputMode="numeric"
              optionalLabel={dict.common.optional}
              maxLength={9}
              hint={words.amountHint(labelOf(task.books))}
            />
            {task.books === 'venue' ? (
              <TextField
                name="capacity"
                id={`task-${task.id}-capacity`}
                label={
                  <>
                    {name}
                    {words.capacityLabel}
                  </>
                }
                inputMode="numeric"
                optionalLabel={dict.common.optional}
                maxLength={9}
                hint={words.capacityHint}
              />
            ) : null}
            <SubmitButton describedBy={describedBy}>
              <Named label={words.markDone} task={task[lang]} />
            </SubmitButton>
          </details>
        )}
      </PostForm>
      <PostForm lang={lang} route="task" token={token}>
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="event" value="delayed" />
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={daysId} className="block font-medium">
              {name}
              {words.delayLabel}
            </label>
            <input
              id={daysId}
              name="days"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DELAY_DAYS}
              step={1}
              required
              aria-describedby={`${daysId}-hint`}
              className={INPUT}
            />
          </div>
          <SubmitButton variant="secondary" describedBy={describedBy}>
            <Named label={words.save} task={task[lang]} />
          </SubmitButton>
        </div>
        <p id={`${daysId}-hint`} className="mt-1 text-sm text-muted">
          {words.delayHint}
        </p>
      </PostForm>
    </div>
  );
}
