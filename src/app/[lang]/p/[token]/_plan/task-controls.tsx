import type { ReactElement } from 'react';

import { TextField } from '@/components/form/fields';
import { PostForm, SubmitButton } from '@/components/form/post-form';
import { DISCLOSURE_GROUP, DisclosureMarker, BUTTON_SUMMARY } from '@/components/layout/disclosure';
import type { ScheduledTask } from '@/core/timeline/schedule-types';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import { MAX_DELAY_DAYS } from '@/schemas/forms/task-event';

/** The id of the element holding a task's name, which each control's button is described by. */
export function taskNameId(task: ScheduledTask): string {
  return `task-${task.id}-name`;
}

const INPUT =
  'block min-h-11 w-24 rounded border border-line bg-background px-3 py-2 text-base text-foreground';

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
}: {
  readonly task: ScheduledTask;
  readonly lang: Lang;
  readonly token: string;
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
            {words.markDone}
          </SubmitButton>
        ) : (
          <details className={DISCLOSURE_GROUP}>
            <summary className={BUTTON_SUMMARY}>
              {words.markDone}
              <DisclosureMarker />
              <span className="sr-only">: {task[lang]}</span>
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
              hint={words.amountHint(dict.form.categories[task.books])}
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
            <SubmitButton describedBy={describedBy}>{words.markDone}</SubmitButton>
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
            {words.save}
          </SubmitButton>
        </div>
        <p id={`${daysId}-hint`} className="mt-1 text-sm text-muted">
          {words.delayHint}
        </p>
      </PostForm>
    </div>
  );
}
