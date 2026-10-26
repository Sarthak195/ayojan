import type { ReactElement } from 'react';

import { StatusWord } from '@/components/status/status-word';
import type { Schedule, ScheduledTask } from '@/core/timeline/schedule-types';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { dateWords } from '../../../_brief/words';

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

/** The timeline: each task's status as an icon and a word, never colour alone (FR-13). */
export function TasksSection({
  schedule,
  lang,
}: {
  readonly schedule: Schedule;
  readonly lang: Lang;
}): ReactElement {
  const words = dictionaryFor(lang).plan;
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
              <span className="font-medium">{task[lang]}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {task.done && task.doneOn !== null
                ? words.doneOn(dateWords(task.doneOn, lang))
                : `${words.finishBy(dateWords(task.latestFinish, lang))}, ${words.slack(task.slackDays)}`}
              {task.onCriticalPath && !task.done ? `. ${words.critical}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
