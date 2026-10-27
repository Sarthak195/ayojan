// The line under a Late task (D45). "Finish by 4 Nov, 2 days late" read as a contradiction while
// 4 Nov was still ahead: Late there means the work no longer fits in the days left. So the line
// says what the task needs against what is left, and what the family should do about it.

import { daysBetween } from '@/core/calendar/day-number';
import type { Schedule, ScheduledTask } from '@/core/timeline/schedule-types';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { dateWords } from '../../../_brief/words';

function startWords(task: ScheduledTask, schedule: Schedule, lang: Lang): string {
  const words = dictionaryFor(lang).plan;
  const waitsOn = schedule.tasks.find((each) => each.id === task.bindingPredecessor);
  if (waitsOn !== undefined) return words.startAfter(waitsOn[lang]);
  // A recorded delay, not a predecessor, can hold the start past today.
  if (daysBetween(schedule.today, task.earliestStart) > 0) {
    return words.startOn(dateWords(task.earliestStart, lang));
  }
  return words.startToday;
}

/** Only for a task whose status is Late; every other status keeps "Finish by ..., N days to spare". */
export function lateLine(task: ScheduledTask, schedule: Schedule, lang: Lang): string {
  const words = dictionaryFor(lang).plan;
  const date = dateWords(task.latestFinish, lang);
  const left = daysBetween(schedule.today, task.latestFinish);
  const situation =
    left < 0
      ? words.latePassed(date)
      : words.lateShort(daysBetween(schedule.today, task.earliestFinish), left, date);
  return `${situation}: ${startWords(task, schedule, lang)}`;
}
