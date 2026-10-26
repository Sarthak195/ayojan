// Task status as a word plus an icon shape (FR-13). Colour is only a redundant third carrier, so
// every status has a silhouette of its own and a reader who cannot tell the colours still can.

import type { TasksFile } from '@/schemas/data/tasks';

export type TaskStatus = 'done' | 'late' | 'atRisk' | 'dueThisWeek' | 'onTrack';

export type StatusIconKey = 'check' | 'octagon' | 'triangle' | 'clock' | 'circle';

export interface StatusPresentation {
  readonly status: TaskStatus;
  /** Key into the page dictionary, which carries the Hindi word. */
  readonly wordKey: string;
  readonly word: string;
  readonly iconKey: StatusIconKey;
}

export interface StatusThresholds {
  readonly atRiskSlackDays: number;
  readonly dueSoonDays: number;
}

export interface StatusFacts {
  readonly done: boolean;
  /** Latest finish minus earliest finish, in days. */
  readonly slackDays: number;
  /** Latest finish minus today: negative once the latest finish has passed. */
  readonly daysToLatestFinish: number;
  /** Latest start minus today. */
  readonly daysToLatestStart: number;
}

const PRESENTATION: Readonly<Record<TaskStatus, StatusPresentation>> = {
  done: { status: 'done', wordKey: 'taskStatus.done', word: 'Done', iconKey: 'check' },
  late: { status: 'late', wordKey: 'taskStatus.late', word: 'Late', iconKey: 'octagon' },
  atRisk: { status: 'atRisk', wordKey: 'taskStatus.atRisk', word: 'At risk', iconKey: 'triangle' },
  dueThisWeek: {
    status: 'dueThisWeek',
    wordKey: 'taskStatus.dueThisWeek',
    word: 'Due this week',
    iconKey: 'clock',
  },
  onTrack: {
    status: 'onTrack',
    wordKey: 'taskStatus.onTrack',
    word: 'On track',
    iconKey: 'circle',
  },
};

export function presentationOf(status: TaskStatus): StatusPresentation {
  return PRESENTATION[status];
}

/** The two limits come from data/tasks.yaml, so the author's assumption is changed in one place. */
export function thresholdsFrom(file: Pick<TasksFile, 'thresholds'>): StatusThresholds {
  return {
    atRiskSlackDays: file.thresholds.atRiskSlackDays.days,
    dueSoonDays: file.thresholds.dueSoonDays.days,
  };
}

/** First match wins, in the order the requirements fix (FR-13). */
export function statusOf(facts: StatusFacts, thresholds: StatusThresholds): TaskStatus {
  if (facts.done) return 'done';
  if (facts.daysToLatestFinish < 0 || facts.slackDays < 0) return 'late';
  if (facts.slackDays < thresholds.atRiskSlackDays) return 'atRisk';
  if (facts.daysToLatestStart <= thresholds.dueSoonDays) return 'dueThisWeek';
  return 'onTrack';
}
