// Data change pinned here: the 2026-10-26 review added decor-sign-off to final-walkthrough's
// dependsOn, so in the celebration profile the walkthrough now waits on decor, not the caterer.
import { describe, expect, it } from 'vitest';

import { daysBetween } from '@/core/calendar/day-number';
import { buildSchedule } from '@/core/timeline/schedule';
import type { Schedule, ScheduleInput } from '@/core/timeline/schedule-types';
import type { TaskSelection } from '@/core/timeline/task-selection';
import { selectTasks } from '@/core/timeline/task-selection';
import type { TaskRow } from '@/schemas/data/tasks';

import {
  DECORATOR_DELAYED,
  EVENT,
  NOTHING_EXTRA,
  TODAY,
  VENUE_BOOKED,
  inputFor,
  iso,
  plus,
  scheduleFor,
  taskIn,
  tasksFile,
  templateOf,
} from './planning-fixture';

const CHANGE_TEST = { done: [VENUE_BOOKED], delays: [DECORATOR_DELAYED] };
const EARLIER_EVENT = plus(EVENT, -14);

function row(
  id: string,
  dependsOn: string[],
  latestFinishDaysBefore: number,
  durationDays: number,
): TaskRow {
  return {
    ...templateOf('book-venue'),
    id,
    dependsOn,
    latestFinishDaysBefore,
    durationDays,
    fasterAlternative: null,
  };
}

function only(rows: TaskRow[], overrides: Partial<ScheduleInput> = {}): Schedule {
  const selection: TaskSelection = { active: rows, knownIds: new Set(rows.map((r) => r.id)) };
  const result = buildSchedule({ ...inputFor(overrides), selection });
  if (!result.ok) throw new Error(`refused: ${result.problem.reason}`);
  return result.schedule;
}

describe('the spec figures, today 31 Oct 2026 and the wedding on 26 Feb 2027', () => {
  const v1 = scheduleFor();

  it('puts Book venue 100 days before the event, with the slack and path the spec gives', () => {
    const venue = taskIn(v1, 'book-venue');
    // Read from the data first, then pinned by hand from spec 5.6 (design-time values).
    expect(venue.latestFinish).toBe(plus(EVENT, -templateOf('book-venue').latestFinishDaysBefore));
    expect(venue.latestFinish).toBe('2026-11-18');
    expect(venue.earliestFinish).toBe('2026-11-10');
    expect(venue.slackDays).toBe(8);
    expect(venue.status).toBe('atRisk');
    expect(venue.onCriticalPath).toBe(true);
    expect(v1.criticalPath).toEqual(['book-venue']);
  });

  it('starts every task with nothing to wait for today', () => {
    for (const id of ['book-venue', 'finalise-guest-list', 'book-photographer', 'return-gifts']) {
      expect(taskIn(v1, id).earliestStart).toBe(TODAY);
    }
  });

  it('shows the change-test setup: caterer slack 18, the decorator starting on 10 Nov', () => {
    const setup = scheduleFor(CHANGE_TEST);
    expect(taskIn(setup, 'book-venue').status).toBe('done');
    expect(taskIn(setup, 'book-caterer').slackDays).toBe(18);
    expect(taskIn(setup, 'book-caterer').status).toBe('onTrack');
    expect(taskIn(setup, 'book-decorator').earliestStart).toBe('2026-11-10');
    expect(taskIn(setup, 'print-invitations').slackDays).toBe(23);
    expect(setup.criticalPath).toEqual(['book-caterer']);
  });

  it('shows the same plan with the event two weeks earlier, as spec 5.2 lists it', () => {
    const moved = scheduleFor({ ...CHANGE_TEST, eventDate: EARLIER_EVENT });
    expect(taskIn(moved, 'book-caterer')).toMatchObject({ slackDays: 4, status: 'atRisk' });
    expect(taskIn(moved, 'print-invitations')).toMatchObject({ slackDays: 9, status: 'atRisk' });
    expect(taskIn(moved, 'book-decorator')).toMatchObject({ slackDays: 9, status: 'atRisk' });
    for (const id of ['decor-sign-off', 'mandap-design', 'final-walkthrough']) {
      expect(taskIn(moved, id).status).toBe('onTrack');
    }
  });
});

describe('arithmetic that holds for any plan', () => {
  const plans: [string, Schedule][] = [
    ['a fresh plan', scheduleFor()],
    ['the change-test setup', scheduleFor(CHANGE_TEST)],
    ['the event two weeks earlier', scheduleFor({ ...CHANGE_TEST, eventDate: EARLIER_EVENT })],
    [
      'a plan with every task delayed a week',
      scheduleFor({
        delays: tasksFile.tasks.map((t) => ({ taskId: t.id, notBefore: plus(TODAY, 7) })),
      }),
    ],
    ['a plan with e-invites', scheduleFor({ faster: ['print-invitations'] })],
  ];

  it.each(plans)(
    'keeps slack equal to latest finish minus earliest finish in %s',
    (_label, plan) => {
      for (const task of plan.tasks) {
        expect(task.slackDays).toBe(daysBetween(task.earliestFinish, task.latestFinish));
      }
    },
  );

  it.each(plans)('never starts an unfinished task before today in %s', (_label, plan) => {
    for (const task of plan.tasks.filter((t) => !t.done)) {
      expect(daysBetween(plan.today, task.earliestStart)).toBeGreaterThanOrEqual(0);
      expect(daysBetween(task.earliestStart, task.earliestFinish)).toBe(task.durationDays);
    }
  });

  it.each(plans)('lists dependencies before their dependants in %s', (_label, plan) => {
    const position = new Map(plan.tasks.map((task, index) => [task.id, index]));
    for (const task of plan.tasks) {
      for (const dependency of task.dependsOn) {
        expect(position.get(dependency)).toBeLessThan(position.get(task.id) ?? -1);
      }
    }
  });

  it.each(plans)(
    'finishes no task later than any unfinished dependant must start in %s',
    (_label, plan) => {
      for (const task of plan.tasks.filter((t) => !t.done)) {
        for (const dependency of task.dependsOn) {
          const before = taskIn(plan, dependency);
          if (before.done) continue;
          expect(daysBetween(before.latestFinish, task.latestStart)).toBeGreaterThanOrEqual(0);
        }
      }
    },
  );
});

describe('order and stability', () => {
  it('gives identical output for the same input twice', () => {
    expect(scheduleFor(CHANGE_TEST)).toEqual(scheduleFor(CHANGE_TEST));
  });

  it('gives every task the same dates when the data lists the templates in another order', () => {
    const reversed = [...tasksFile.tasks].reverse();
    const selection = selectTasks(reversed, { functions: {}, mustHaves: [], needs: [] }, 'wedding');
    const result = buildSchedule({ ...inputFor(CHANGE_TEST), selection });
    if (!result.ok) throw new Error('refused');
    const straight = scheduleFor(CHANGE_TEST, NOTHING_EXTRA);
    expect(result.schedule.tasks).toHaveLength(straight.tasks.length);
    for (const task of straight.tasks) {
      expect(taskIn(result.schedule, task.id)).toMatchObject({
        earliestStart: task.earliestStart,
        latestFinish: task.latestFinish,
        slackDays: task.slackDays,
        status: task.status,
      });
    }
  });

  it('joins the diamond at the later of its two branches and names that branch', () => {
    const v1 = scheduleFor();
    const walkthrough = taskIn(v1, 'final-walkthrough');
    expect(walkthrough.dependsOn).toEqual(
      expect.arrayContaining(['mandap-design', 'book-caterer']),
    );
    const mandap = taskIn(v1, 'mandap-design');
    const caterer = taskIn(v1, 'book-caterer');
    expect(walkthrough.earliestStart).toBe(
      mandap.earliestFinish >= caterer.earliestFinish
        ? mandap.earliestFinish
        : caterer.earliestFinish,
    );
    expect(walkthrough.bindingPredecessor).toBe('mandap-design');
    const lateCaterer = scheduleFor({
      delays: [{ taskId: 'book-caterer', notBefore: plus(TODAY, 60) }],
    });
    expect(taskIn(lateCaterer, 'final-walkthrough').bindingPredecessor).toBe('book-caterer');
  });

  it('schedules a single task and a disconnected graph', () => {
    const solo = only([row('solo', [], 30, 5)]);
    expect(solo.tasks).toHaveLength(1);
    expect(solo.tasks[0]).toMatchObject({
      earliestStart: TODAY,
      slackDays: daysBetween(TODAY, plus(EVENT, -30)) - 5,
    });
    expect(solo.criticalPath).toEqual(['solo']);
    const apart = only([row('a', [], 100, 5), row('b', [], 50, 5)]);
    expect(apart.tasks.map((t) => t.earliestStart)).toEqual([TODAY, TODAY]);
    expect(apart.criticalPath).toEqual(['a']);
  });

  it('returns an empty schedule when nothing is active', () => {
    const empty = only([]);
    expect(empty.tasks).toEqual([]);
    expect(empty.criticalPath).toEqual([]);
  });
});

describe('the critical path', () => {
  it('walks back through the predecessors that set each start, ties by data order', () => {
    // Listed last-first so the tie among equal slacks goes to the end of the chain.
    const chain = only([row('c', ['b'], 80, 10), row('b', ['a'], 90, 10), row('a', [], 100, 10)]);
    expect(chain.criticalPath).toEqual(['a', 'b', 'c']);
    expect(chain.tasks.every((t) => t.onCriticalPath)).toBe(true);
  });

  it('skips finished tasks and is empty when everything is done', () => {
    const everyone = scheduleFor().tasks.map((t) => ({
      taskId: t.id,
      on: TODAY,
      amountInr: null,
      capacity: null,
    }));
    const finished = scheduleFor({ done: everyone });
    expect(finished.criticalPath).toEqual([]);
    expect(finished.tasks.every((t) => t.status === 'done')).toBe(true);
  });
});

describe('the event date and the notice period', () => {
  it("cuts every unfinished task's slack by exactly the days moved and leaves earliest starts alone", () => {
    const before = scheduleFor();
    const after = scheduleFor({ eventDate: EARLIER_EVENT });
    for (const task of before.tasks) {
      const moved = taskIn(after, task.id);
      expect(moved.slackDays).toBe(task.slackDays - 14);
      expect(moved.earliestStart).toBe(task.earliestStart);
      expect(moved.latestFinish).toBe(plus(task.latestFinish, -14));
    }
  });

  it('shows an unbooked Book venue falling from slack 8 to -6 and Late, as the requirements say', () => {
    const venue = taskIn(scheduleFor({ eventDate: EARLIER_EVENT }), 'book-venue');
    expect(venue.slackDays).toBe(-6);
    expect(venue.status).toBe('late');
  });

  it('computes an event 20 days away, with Book venue Late', () => {
    const near = scheduleFor({ eventDate: plus(TODAY, 20) });
    expect(near.daysToEvent).toBe(20);
    expect(near.shortNotice).toBe(false);
    expect(taskIn(near, 'book-venue').status).toBe('late');
  });

  it('computes an event tomorrow with every unfinished task Late', () => {
    const tomorrow = scheduleFor({ eventDate: plus(TODAY, 1) });
    expect(tomorrow.tasks.every((task) => task.status === 'late')).toBe(true);
  });

  it('still computes when the event is today or past, rather than breaking an old link', () => {
    for (const offset of [0, -3]) {
      const gone = scheduleFor({ eventDate: plus(TODAY, offset) });
      expect(gone.daysToEvent).toBe(offset);
      expect(gone.shortNotice).toBe(true);
      expect(gone.tasks.every((task) => task.status === 'late')).toBe(true);
    }
  });

  it.each<[number, boolean]>([
    [13, true],
    [14, false],
    [118, false],
  ])('flags short notice for an event %i days away: %s', (days, expected) => {
    expect(scheduleFor({ eventDate: plus(TODAY, days) }).shortNotice).toBe(expected);
  });
});

describe('finished tasks', () => {
  it('push nobody: a task marked done today frees its dependants to start today', () => {
    const open = scheduleFor();
    const booked = scheduleFor({ done: [VENUE_BOOKED] });
    expect(taskIn(open, 'book-caterer').earliestStart).toBe(
      taskIn(open, 'book-venue').earliestFinish,
    );
    expect(taskIn(booked, 'book-caterer').earliestStart).toBe(TODAY);
  });

  it('leave their dependants Late when the dates were already missed', () => {
    const tight = scheduleFor({ eventDate: plus(TODAY, 20), done: [VENUE_BOOKED] });
    expect(taskIn(tight, 'book-venue').status).toBe('done');
    expect(taskIn(tight, 'book-caterer').earliestStart).toBe(TODAY);
    expect(taskIn(tight, 'book-caterer').status).toBe('late');
  });

  it('are fixed at the day they were marked, whatever today is', () => {
    const later = scheduleFor({ today: plus(TODAY, 9), done: [VENUE_BOOKED] });
    expect(taskIn(later, 'book-venue')).toMatchObject({
      done: true,
      doneOn: TODAY,
      earliestFinish: TODAY,
    });
  });

  it('keep the later date when the same task is marked twice, in either order', () => {
    const later = { ...VENUE_BOOKED, on: plus(TODAY, 5) };
    for (const done of [
      [VENUE_BOOKED, later],
      [later, VENUE_BOOKED],
    ]) {
      const plan = scheduleFor({ today: plus(TODAY, 6), done });
      expect(taskIn(plan, 'book-venue').doneOn).toBe(plus(TODAY, 5));
    }
  });

  it('ignore a record for a task that is not in the plan', () => {
    const stray = { taskId: 'haldi-arrangements', on: TODAY, amountInr: null, capacity: null };
    expect(scheduleFor({ done: [stray] })).toEqual(scheduleFor());
  });
});

describe('delays, stored as absolute dates', () => {
  it.each([1, 10, 60])('holds the decorator back until %i days from today', (days) => {
    const notBefore = plus(TODAY, days);
    const plan = scheduleFor({
      done: [VENUE_BOOKED],
      delays: [{ taskId: 'book-decorator', notBefore }],
    });
    expect(taskIn(plan, 'book-decorator')).toMatchObject({ earliestStart: notBefore, notBefore });
  });

  it('shows the same earliest starts three days later (D11)', () => {
    const base = { done: [VENUE_BOOKED], delays: [DECORATOR_DELAYED] };
    const onDayOne = scheduleFor(base);
    const onDayFour = scheduleFor({ ...base, today: plus(TODAY, 3) });
    for (const id of ['book-decorator', 'decor-sign-off', 'mandap-design', 'final-walkthrough']) {
      expect(taskIn(onDayFour, id).earliestStart).toBe(taskIn(onDayOne, id).earliestStart);
    }
  });

  it('uses the latest of several delays recorded for one task', () => {
    const delays = ['2026-11-10', '2026-11-20', '2026-11-15'].map((day) => ({
      taskId: 'book-decorator',
      notBefore: iso(day),
    }));
    const plan = scheduleFor({ done: [VENUE_BOOKED], delays });
    expect(taskIn(plan, 'book-decorator').earliestStart).toBe('2026-11-20');
  });

  it('ignores a delay whose date has passed', () => {
    const plan = scheduleFor({
      today: plus(TODAY, 30),
      delays: [DECORATOR_DELAYED],
      done: [VENUE_BOOKED],
    });
    expect(taskIn(plan, 'book-decorator').earliestStart).toBe(plus(TODAY, 30));
  });

  it('pushes the dependants of a delayed task and no other task', () => {
    const base = scheduleFor({ done: [VENUE_BOOKED] });
    const delayed = scheduleFor(CHANGE_TEST);
    const moved = delayed.tasks
      .filter((task) => task.earliestStart !== taskIn(base, task.id).earliestStart)
      .map((task) => task.id);
    expect(moved.sort()).toEqual(
      ['book-decorator', 'decor-sign-off', 'mandap-design', 'final-walkthrough'].sort(),
    );
  });
});

describe('a dependency on a template that is not in the plan', () => {
  const celebration = (): Schedule => {
    const selection = selectTasks(tasksFile.tasks, NOTHING_EXTRA, 'celebration');
    const result = buildSchedule({ ...inputFor(), selection });
    if (!result.ok) throw new Error('refused');
    return result.schedule;
  };

  it('counts as satisfied: the walkthrough no longer waits for the dropped mandap', () => {
    const plan = celebration();
    expect(plan.tasks.some((task) => task.id === 'mandap-design')).toBe(false);
    const walkthrough = taskIn(plan, 'final-walkthrough');
    expect(templateOf('final-walkthrough').dependsOn).toContain('mandap-design');
    // Decor sign-off (venue 10 days, decorator 10, sign-off 7) finishes on day 27, after the
    // caterer on day 20, so it is the predecessor that sets the visit.
    expect(walkthrough.dependsOn).toEqual(['book-caterer', 'decor-sign-off']);
    expect(walkthrough.bindingPredecessor).toBe('decor-sign-off');
    expect(walkthrough.earliestStart).toBe(taskIn(plan, 'decor-sign-off').earliestFinish);
  });
});

describe('the faster alternative', () => {
  it('re-runs the schedule: e-invites clear the At risk on Print invitations', () => {
    const moved = { ...CHANGE_TEST, eventDate: EARLIER_EVENT };
    const slow = taskIn(scheduleFor(moved), 'print-invitations');
    const quick = taskIn(
      scheduleFor({ ...moved, faster: ['print-invitations'] }),
      'print-invitations',
    );
    const alternative = templateOf('print-invitations').fasterAlternative;
    expect(slow.status).toBe('atRisk');
    expect(quick).toMatchObject({
      fasterApplied: true,
      durationDays: alternative?.durationDays,
      en: alternative?.en,
      status: 'onTrack',
    });
    expect(quick.slackDays).toBeGreaterThan(slow.slackDays);
  });

  it('ignores a task that has no alternative', () => {
    expect(scheduleFor({ faster: ['book-venue'] })).toEqual(scheduleFor());
  });
});

describe('refusals', () => {
  it('names a cycle instead of looping', () => {
    const rows = [row('a', ['b'], 50, 1), row('b', ['a'], 50, 1)];
    const selection: TaskSelection = { active: rows, knownIds: new Set(['a', 'b']) };
    const result = buildSchedule({ ...inputFor(), selection });
    expect(result).toMatchObject({ ok: false, problem: { reason: 'cycle' } });
  });

  it('refuses an unknown dependency and a duplicate id', () => {
    const asked = (rows: TaskRow[]) => {
      const selection: TaskSelection = { active: rows, knownIds: new Set(rows.map((r) => r.id)) };
      return buildSchedule({ ...inputFor(), selection });
    };
    expect(asked([row('a', ['nope'], 50, 1)])).toMatchObject({
      ok: false,
      problem: { reason: 'unknown-dependency', taskIds: ['a', 'nope'] },
    });
    expect(asked([row('a', [], 50, 1), row('a', [], 50, 1)])).toMatchObject({
      ok: false,
      problem: { reason: 'duplicate-task' },
    });
  });

  it('refuses dates the calendar cannot hold instead of printing nonsense', () => {
    const result = buildSchedule(
      inputFor({ delays: [{ taskId: 'book-venue', notBefore: iso('9999-12-31') }] }),
    );
    expect(result).toMatchObject({ ok: false, problem: { reason: 'date-out-of-range' } });
  });
});
