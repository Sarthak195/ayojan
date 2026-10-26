import type { ReactElement } from 'react';

import { presentationOf, type TaskStatus } from '@/core/timeline/status';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { Icon } from './icon';

// Colour is the third, redundant carrier after the word and the shape.
const TONE: Readonly<Record<TaskStatus, string>> = {
  done: 'text-ok',
  late: 'text-late',
  atRisk: 'text-risk',
  dueThisWeek: 'text-info',
  onTrack: 'text-muted',
};

/** A task status as icon plus word, e.g. a warning triangle and "At risk". */
export function StatusWord({
  status,
  lang,
}: {
  readonly status: TaskStatus;
  readonly lang: Lang;
}): ReactElement {
  const { iconKey } = presentationOf(status);
  const word = dictionaryFor(lang).common.status[status];
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${TONE[status]}`}>
      <Icon name={iconKey} />
      <span className="text-foreground">{word}</span>
    </span>
  );
}
