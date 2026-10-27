import type { ReactElement } from 'react';

import { StatusWord } from '@/components/status/status-word';
import type { DelayPropagation } from '@/core/timeline/schedule-change';
import type { Schedule, ScheduledTask } from '@/core/timeline/schedule-types';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { dateWords } from '../../../_brief/words';
import type { CategoryLabel } from '../_change/category-labels';
import { lateLine } from './late-line';
import { TaskControls, taskNameId } from './task-controls';

/** The critical path first, in its own order, then every other task in schedule order. */
function criticalFirst(schedule: Schedule): ScheduledTask[] {
  const byId = new Map(schedule.tasks.map((task) => [task.id, task]));
  const critical = schedule.criticalPath.flatMap((id) => {
    const task = byId.get(id);
    return task === undefined ? [] : [task];
  });
  const rest = schedule.tasks.filter((task) => !schedule.criticalPath.includes(task.id));
  return [...critical, ...rest];
}

function nameOf(schedule: Schedule, id: string, lang: Lang): string {
  return schedule.tasks.find((task) => task.id === id)?.[lang] ?? id;
}

/**
 * The dependants a delay moved, as "Moved later: ..." for the status line after the 303. It is
 * worked out from the plan in the link, because nothing but the token rides in the redirect.
 */
export function movedSummary(
  schedule: Schedule,
  effects: readonly DelayPropagation[],
  delayedTaskId: string,
  lang: Lang,
): string {
  const words = dictionaryFor(lang).tasks;
  const effect = effects.find((each) => each.delayedTaskId === delayedTaskId);
  if (effect === undefined || effect.dependants.length === 0) return words.summaryNoneMoved;
  const names = effect.dependants.map((dependant) => nameOf(schedule, dependant.taskId, lang));
  return words.summaryMoved(names.join(', '));
}

function MovedList({
  schedule,
  effect,
  lang,
}: {
  readonly schedule: Schedule;
  readonly effect: DelayPropagation | undefined;
  readonly lang: Lang;
}): ReactElement | null {
  if (effect === undefined || effect.dependants.length === 0) return null;
  const words = dictionaryFor(lang).tasks;
  const because = nameOf(schedule, effect.delayedTaskId, lang);
  return (
    <ul className="mt-1 list-disc pl-6 text-sm">
      {effect.dependants.map((dependant) => (
        <li key={dependant.taskId}>
          {words.moved(
            nameOf(schedule, dependant.taskId, lang),
            dependant.movedDays,
            because,
            dependant.slackDays,
          )}
        </li>
      ))}
    </ul>
  );
}

/** The timeline: each task's status as an icon and a word, never colour alone (FR-13). */
export function TasksSection({
  schedule,
  delayEffects,
  lang,
  token,
  labelOf,
}: {
  readonly schedule: Schedule;
  readonly delayEffects: readonly DelayPropagation[];
  readonly lang: Lang;
  readonly token: string;
  readonly labelOf: CategoryLabel;
}): ReactElement {
  const words = dictionaryFor(lang).plan;
  const taskWords = dictionaryFor(lang).tasks;
  return (
    <section id="tasks" aria-labelledby="tasks-heading" className="mt-8">
      <h2 id="tasks-heading" className="text-xl font-semibold">
        {words.tasksHeading}
      </h2>
      <ul className="mt-2 divide-y divide-line">
        {criticalFirst(schedule).map((task) => (
          <li key={task.id} className="py-3">
            <p className="flex flex-wrap items-center gap-x-3">
              <StatusWord status={task.status} lang={lang} />
              <span id={taskNameId(task)} className="font-medium">
                {task[lang]}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {task.done && task.doneOn !== null
                ? words.doneOn(dateWords(task.doneOn, lang))
                : task.status === 'late'
                  ? lateLine(task, schedule, lang)
                  : `${words.finishBy(dateWords(task.latestFinish, lang))}, ${words.slack(task.slackDays)}`}
              {task.onCriticalPath && !task.done ? `. ${words.critical}` : ''}
              {task.notBefore !== null && !task.done
                ? `. ${taskWords.notBefore(dateWords(task.notBefore, lang))}`
                : ''}
            </p>
            <MovedList
              schedule={schedule}
              effect={delayEffects.find((each) => each.delayedTaskId === task.id)}
              lang={lang}
            />
            <TaskControls task={task} lang={lang} token={token} labelOf={labelOf} />
          </li>
        ))}
      </ul>
    </section>
  );
}
