import { describe, expect, it } from 'vitest';

import { buildSchedule } from '@/core/timeline/schedule';
import { delayEffect, eventDateEffect, worsenedStatuses } from '@/core/timeline/schedule-change';
import type { TaskSelection } from '@/core/timeline/task-selection';
import { selectTasks } from '@/core/timeline/task-selection';

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
  templateOf,
} from './planning-fixture';

function delayed(taskId: string, notBefore: ReturnType<typeof iso>, done = [VENUE_BOOKED]) {
  const effect = delayEffect(inputFor({ done }), { taskId, notBefore });
  if (!effect.ok) throw new Error(`refused: ${effect.problem.reason}`);
  return effect;
}

describe('a delay and who it moves', () => {
  it('lists the three dependants of the decorator, each ten days later and because of it', () => {
    const { propagation } = delayed('book-decorator', DECORATOR_DELAYED.notBefore);
    expect(propagation.delayedTaskId).toBe('book-decorator');
    expect(propagation.movedDays).toBe(10);
    expect(propagation.dependants.map((dependant) => dependant.taskId)).toEqual([
      'decor-sign-off',
      'mandap-design',
      'final-walkthrough',
    ]);
    for (const dependant of propagation.dependants) {
      expect(dependant).toMatchObject({ movedDays: 10, becauseOf: 'book-decorator' });
    }
  });

  it('gives each dependant its new slack and status, which stay large and On track', () => {
    const { propagation, schedule } = delayed('book-decorator', DECORATOR_DELAYED.notBefore);
    for (const dependant of propagation.dependants) {
      expect(dependant.slackDays).toBe(taskIn(schedule, dependant.taskId).slackDays);
      expect(dependant.slackDays).toBeGreaterThanOrEqual(14);
      expect(dependant.status).toBe('onTrack');
    }
  });

  it('lists nothing for a task that nothing waits on', () => {
    const { propagation } = delayed('book-photographer', plus(TODAY, 10));
    expect(propagation.movedDays).toBe(10);
    expect(propagation.dependants).toEqual([]);
  });

  it('lists only what is downstream: delaying the sign-off leaves the decorator alone', () => {
    const { propagation } = delayed('decor-sign-off', plus(TODAY, 40));
    expect(propagation.dependants.map((dependant) => dependant.taskId)).toEqual([
      'mandap-design',
      'final-walkthrough',
    ]);
  });

  it('lists dependants down the whole chain, not only the direct ones', () => {
    const { propagation } = delayed('finalise-guest-list', plus(TODAY, 20));
    expect(propagation.dependants.map((dependant) => dependant.taskId)).toEqual([
      'print-invitations',
      'send-invitations',
      'final-headcount',
    ]);
    expect(propagation.dependants.every((dependant) => dependant.movedDays === 20)).toBe(true);
  });

  it('reports a delay that changes nothing as no movement', () => {
    const { propagation } = delayed('book-decorator', TODAY);
    expect(propagation).toMatchObject({ movedDays: 0, dependants: [] });
  });

  it('leaves out a dependant that was already waiting on something later', () => {
    // The caterer's walkthrough already waits for the mandap on 4 Dec, so a delay that only
    // pushes the caterer to 20 Nov moves the walkthrough by nothing.
    const { propagation } = delayed('book-caterer', plus(TODAY, 20), []);
    const ids = propagation.dependants.map((dependant) => dependant.taskId);
    expect(ids).toContain('menu-tasting');
    expect(ids).not.toContain('final-walkthrough');
  });

  it('passes a scheduling refusal through', () => {
    const input = inputFor({ delays: [{ taskId: 'book-venue', notBefore: iso('9999-12-31') }] });
    expect(delayEffect(input, DECORATOR_DELAYED)).toMatchObject({ ok: false });
  });
});

describe('the event date moving earlier', () => {
  const setup = inputFor({ done: [VENUE_BOOKED], delays: [DECORATOR_DELAYED] });
  const earlier = plus(EVENT, -14);

  function shiftsFor(input = setup, eventDate = earlier) {
    const effect = eventDateEffect(input, eventDate);
    if (!effect.ok) throw new Error(`refused: ${effect.problem.reason}`);
    return effect;
  }

  it('lists the tasks the spec names, with their slack before and after', () => {
    const { shifts } = shiftsFor();
    const byId = new Map(shifts.map((shift) => [shift.taskId, shift]));
    expect(byId.get('book-caterer')).toEqual({
      taskId: 'book-caterer',
      from: 'onTrack',
      to: 'atRisk',
      slackBefore: 18,
      slackAfter: 4,
    });
    expect(byId.get('print-invitations')).toMatchObject({
      slackBefore: 23,
      slackAfter: 9,
      to: 'atRisk',
    });
    expect(byId.get('book-decorator')).toMatchObject({ slackAfter: 9, to: 'atRisk' });
    expect(byId.has('final-walkthrough')).toBe(false);
  });

  it('shows the moved plan next to the list', () => {
    expect(shiftsFor().schedule.eventDate).toBe(earlier);
    expect(shiftsFor().schedule.today).toBe(TODAY);
  });

  it('sends a task from At risk to Late when the move is large enough', () => {
    const { shifts } = shiftsFor(setup, plus(EVENT, -30));
    expect(shifts.find((shift) => shift.taskId === 'book-caterer')).toMatchObject({ to: 'late' });
    expect(shifts.every((shift) => shift.to === 'late' || shift.to === 'atRisk')).toBe(true);
  });

  it('turns an unbooked Book venue Late', () => {
    const { shifts } = shiftsFor(inputFor(), earlier);
    expect(shifts.find((shift) => shift.taskId === 'book-venue')).toMatchObject({
      from: 'atRisk',
      to: 'late',
      slackBefore: 8,
      slackAfter: -6,
    });
  });

  it('does not throw when the new date is earlier than every lead time', () => {
    const { schedule, shifts } = shiftsFor(setup, plus(TODAY, 3));
    expect(
      schedule.tasks.filter((task) => !task.done).every((task) => task.status === 'late'),
    ).toBe(true);
    expect(shifts.length).toBeGreaterThan(0);
  });

  it('reports nothing when the date does not move or moves later', () => {
    expect(shiftsFor(setup, EVENT).shifts).toEqual([]);
    expect(shiftsFor(setup, plus(EVENT, 30)).shifts).toEqual([]);
  });

  it('never lists a task that is done', () => {
    const { shifts } = shiftsFor(setup, plus(EVENT, -60));
    expect(shifts.some((shift) => shift.taskId === 'book-venue')).toBe(false);
  });

  it('compares any two schedules, so the revision diff can reuse it', () => {
    const before = scheduleFor();
    const after = scheduleFor({ faster: ['print-invitations'], eventDate: plus(EVENT, -14) });
    const shifts = worsenedStatuses(before, after);
    expect(shifts.some((shift) => shift.taskId === 'print-invitations')).toBe(false);
    expect(shifts.some((shift) => shift.taskId === 'book-caterer')).toBe(true);
  });

  it('passes a scheduling refusal through', () => {
    const selection: TaskSelection = {
      ...selectTasks([templateOf('book-venue')], NOTHING_EXTRA, 'wedding'),
      active: [{ ...templateOf('book-venue'), dependsOn: ['book-venue'] }],
    };
    expect(buildSchedule({ ...setup, selection })).toMatchObject({ ok: false });
    expect(eventDateEffect({ ...setup, selection }, earlier)).toMatchObject({
      ok: false,
      problem: { reason: 'cycle' },
    });
  });
});
