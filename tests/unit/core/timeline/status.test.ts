import { describe, expect, it } from 'vitest';

import { presentationOf, statusOf, thresholdsFrom } from '@/core/timeline/status';
import type { StatusFacts, TaskStatus } from '@/core/timeline/status';

import { tasksFile } from './planning-fixture';

const limits = thresholdsFrom(tasksFile);

// Far enough from every boundary that only the field under test decides.
const FAR = { daysToLatestFinish: 90, daysToLatestStart: 80 };

function facts(overrides: Partial<StatusFacts>): StatusFacts {
  return { done: false, slackDays: 30, ...FAR, ...overrides };
}

describe('thresholds', () => {
  it('are read from the data file', () => {
    expect(limits.atRiskSlackDays).toBe(tasksFile.thresholds.atRiskSlackDays.days);
    expect(limits.dueSoonDays).toBe(tasksFile.thresholds.dueSoonDays.days);
  });
});

describe('status, first match wins', () => {
  // The boundaries are written in terms of the data's limits (14 and 7 in the draft data), so a
  // changed limit moves the numbers with it.
  const atRisk = limits.atRiskSlackDays;
  const dueSoon = limits.dueSoonDays;

  it.each<[string, Partial<StatusFacts>, TaskStatus]>([
    [
      'done wins over a negative slack',
      { done: true, slackDays: -5, daysToLatestFinish: -9 },
      'done',
    ],
    ['slack at the at-risk limit is not at risk', { slackDays: atRisk }, 'onTrack'],
    ['slack one under the limit is at risk', { slackDays: atRisk - 1 }, 'atRisk'],
    ['zero slack is at risk, not late', { slackDays: 0 }, 'atRisk'],
    ['slack of minus one is late', { slackDays: -1 }, 'late'],
    [
      'a passed latest finish is late even with slack',
      { slackDays: 20, daysToLatestFinish: -1 },
      'late',
    ],
    [
      'a task of no duration finishing today is not late',
      { slackDays: 0, daysToLatestFinish: 0, daysToLatestStart: 0 },
      'atRisk',
    ],
    [
      'a latest start at the due-soon limit is due this week',
      { daysToLatestStart: dueSoon },
      'dueThisWeek',
    ],
    [
      'a latest start one day past the limit is on track',
      { daysToLatestStart: dueSoon + 1 },
      'onTrack',
    ],
    ['at risk beats due this week', { slackDays: 3, daysToLatestStart: 2 }, 'atRisk'],
    ['late beats at risk', { slackDays: -3, daysToLatestStart: 2 }, 'late'],
    ['plenty of slack and time is on track', {}, 'onTrack'],
  ])('%s', (_label, overrides, expected) => {
    expect(statusOf(facts(overrides), limits)).toBe(expected);
  });
});

describe('presentation', () => {
  const all: TaskStatus[] = ['done', 'late', 'atRisk', 'dueThisWeek', 'onTrack'];

  it('gives each status its own word key and icon, so colour is never the only carrier', () => {
    const shown = all.map(presentationOf);
    expect(new Set(shown.map((entry) => entry.wordKey)).size).toBe(all.length);
    expect(new Set(shown.map((entry) => entry.iconKey)).size).toBe(all.length);
    expect(shown.map((entry) => entry.status)).toEqual(all);
  });

  it.each<[TaskStatus, string]>([
    ['done', 'Done'],
    ['late', 'Late'],
    ['atRisk', 'At risk'],
    ['dueThisWeek', 'Due this week'],
    ['onTrack', 'On track'],
  ])('shows %s as the words "%s"', (status, word) => {
    expect(presentationOf(status).word).toBe(word);
  });
});
