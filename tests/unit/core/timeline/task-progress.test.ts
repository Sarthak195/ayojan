import { describe, expect, it } from 'vitest';

import {
  MAX_DELAY_DAYS,
  MIN_DELAY_DAYS,
  bookingsFrom,
  delayTask,
  markDone,
  progressFromOps,
} from '@/core/timeline/task-progress';
import type { MarkDoneRefusal } from '@/core/timeline/task-progress';
import { resolveTask } from '@/core/timeline/task-selection';
import type { Op } from '@/schemas/plan/op';

import {
  DECORATOR_DELAYED,
  PERSONA,
  TODAY,
  VENUE_BOOKED,
  inputFor,
  iso,
  plus,
  scheduleFor,
} from './planning-fixture';

const tasks = inputFor({}, PERSONA).selection.active.map((row) => resolveTask(row, false));

function done(taskId: string, amountInr: number | null, capacity: number | null) {
  return { taskId, on: TODAY, amountInr, capacity };
}

describe('marking a task done: the one booking path (D10)', () => {
  it('books the venue at the amount, with the capacity, as spec 5.6 describes', () => {
    const result = markDone(done('book-venue', 180_000, 220), tasks);
    expect(result).toEqual({
      ok: true,
      record: done('book-venue', 180_000, 220),
      booking: { taskId: 'book-venue', category: 'venue', amountInr: 180_000, capacity: 220 },
    });
  });

  it.each<[string, string, string]>([
    ['the decorator', 'book-decorator', 'decor'],
    ['the caterer', 'book-caterer', 'catering'],
    ['the photographer', 'book-photographer', 'photo'],
    ['the dhol', 'book-dhol-or-band', 'music'],
  ])('books the category of %s at the amount', (_label, taskId, category) => {
    const result = markDone(done(taskId, 53_000, null), tasks);
    expect(result).toMatchObject({
      ok: true,
      booking: { category, amountInr: 53_000, capacity: null },
    });
  });

  it('marks a booking task done with no amount and reports no booking', () => {
    expect(markDone(done('book-caterer', null, null), tasks)).toEqual({
      ok: true,
      record: done('book-caterer', null, null),
      booking: null,
    });
  });

  it('keeps a capacity given without an amount on the record, with no booking to report', () => {
    expect(markDone(done('book-venue', null, 220), tasks)).toEqual({
      ok: true,
      record: done('book-venue', null, 220),
      booking: null,
    });
  });

  it('treats an amount of zero as a number the family typed, not as unset', () => {
    expect(markDone(done('book-decorator', 0, null), tasks)).toMatchObject({
      ok: true,
      booking: { amountInr: 0 },
    });
  });

  it('marks a task that books nothing done without a booking', () => {
    expect(markDone(done('menu-tasting', null, null), tasks)).toMatchObject({
      ok: true,
      booking: null,
    });
  });

  it.each<[string, ReturnType<typeof done>, MarkDoneRefusal]>([
    ['an unknown task', done('book-moon', null, null), 'unknown-task'],
    ['a task that is not in the plan', done('haldi-arrangements', null, null), 'unknown-task'],
    [
      'an amount on a task that books nothing',
      done('menu-tasting', 5_000, null),
      'amount-on-task-without-booking',
    ],
    ['a negative amount', done('book-venue', -1, null), 'amount-not-whole-rupees'],
    ['a fractional amount', done('book-venue', 1_000.5, null), 'amount-not-whole-rupees'],
    ['a capacity of zero', done('book-venue', 1_000, 0), 'capacity-not-positive-whole-number'],
    ['a fractional capacity', done('book-venue', 1_000, 2.5), 'capacity-not-positive-whole-number'],
    [
      'a capacity on the caterer',
      done('book-caterer', 1_000, 200),
      'capacity-on-task-without-venue',
    ],
  ])('refuses %s', (_label, request, reason) => {
    expect(markDone(request, tasks)).toEqual({ ok: false, reason });
  });
});

describe('bookings the budget engine reads', () => {
  it('lists one booking per booked task, in data order', () => {
    const records = [done('book-decorator', 53_000, null), done('book-venue', 180_000, 220)];
    expect(bookingsFrom(records, tasks).map((entry) => entry.category)).toEqual(['venue', 'decor']);
  });

  it('leaves out tasks done without an amount and tasks that book nothing', () => {
    expect(
      bookingsFrom([done('book-caterer', null, null), done('menu-tasting', null, null)], tasks),
    ).toEqual([]);
  });

  it('lets the later mark win when a task is marked twice', () => {
    const first = done('book-venue', 180_000, 220);
    const second = { ...done('book-venue', 170_000, 200), on: plus(TODAY, 2) };
    expect(bookingsFrom([second, first], tasks)).toMatchObject([
      { amountInr: 170_000, capacity: 200 },
    ]);
    const withoutAmount = { ...done('book-venue', null, null), on: plus(TODAY, 2) };
    expect(bookingsFrom([first, withoutAmount], tasks)).toEqual([]);
  });

  it('ignores a record for a task outside the plan', () => {
    expect(bookingsFrom([done('haldi-arrangements', 1_000, null)], tasks)).toEqual([]);
  });
});

describe('delaying a task: an absolute date (D11)', () => {
  const setup = scheduleFor({ done: [VENUE_BOOKED] });

  it('stores 10 Nov for the decorator delayed 10 days on 31 Oct, as FR-14 says', () => {
    expect(delayTask(setup, 'book-decorator', 10)).toEqual({ ok: true, record: DECORATOR_DELAYED });
  });

  it.each([MIN_DELAY_DAYS, MAX_DELAY_DAYS])('accepts %i days at the edge of the range', (days) => {
    expect(delayTask(setup, 'book-decorator', days)).toEqual({
      ok: true,
      record: { taskId: 'book-decorator', notBefore: plus(TODAY, days) },
    });
  });

  it.each([0, -1, 61, 2.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses %s days', (days) => {
    expect(delayTask(setup, 'book-decorator', days)).toEqual({
      ok: false,
      reason: 'days-out-of-range',
    });
  });

  it('counts a second delay from where the task now starts, so delays add up', () => {
    const delayed = scheduleFor({ done: [VENUE_BOOKED], delays: [DECORATOR_DELAYED] });
    expect(delayTask(delayed, 'book-decorator', 5)).toEqual({
      ok: true,
      record: { taskId: 'book-decorator', notBefore: plus(TODAY, 15) },
    });
  });

  it('moves a task waiting on a predecessor by the full number of days', () => {
    const fresh = scheduleFor();
    const caterer = fresh.tasks.find((task) => task.id === 'book-caterer');
    expect(caterer?.earliestStart).toBe(plus(TODAY, 10));
    expect(delayTask(fresh, 'book-caterer', 10)).toMatchObject({
      ok: true,
      record: { notBefore: plus(TODAY, 20) },
    });
  });

  it('refuses a task that is unknown, outside the plan or already done', () => {
    expect(delayTask(setup, 'book-moon', 3)).toEqual({ ok: false, reason: 'unknown-task' });
    expect(delayTask(setup, 'haldi-arrangements', 3)).toEqual({
      ok: false,
      reason: 'unknown-task',
    });
    expect(delayTask(setup, 'book-venue', 3)).toEqual({ ok: false, reason: 'already-done' });
  });

  it('refuses a delay that would leave the calendar', () => {
    const far = scheduleFor({ delays: [{ taskId: 'book-decorator', notBefore: plus(TODAY, 1) }] });
    const result = delayTask(
      {
        ...far,
        tasks: far.tasks.map((task) => ({
          ...task,
          earliestStart: iso('9999-12-31'),
        })),
      },
      'book-decorator',
      3,
    );
    expect(result).toEqual({ ok: false, reason: 'date-out-of-range' });
  });
});

describe('reading progress out of the ops', () => {
  it('collects done and delayed records in ledger order and skips every other op', () => {
    const ops: Op[] = [
      {
        kind: 'taskDone',
        taskId: 'book-venue',
        on: '2026-10-31',
        amountInr: 180_000,
        capacity: 220,
      },
      { kind: 'leversApplied', leverIds: [], raiseBudgetInr: null },
      { kind: 'taskDelayed', taskId: 'book-decorator', notBefore: '2026-11-10' },
      {
        kind: 'taskDone',
        taskId: 'book-caterer',
        on: '2026-11-02',
        amountInr: null,
        capacity: null,
      },
    ];
    const progress = progressFromOps(ops);
    expect(progress.done.map((record) => record.taskId)).toEqual(['book-venue', 'book-caterer']);
    expect(progress.done[0]).toEqual(VENUE_BOOKED);
    expect(progress.delays).toEqual([DECORATOR_DELAYED]);
  });

  it('skips a record whose date does not parse rather than throwing', () => {
    const ops: Op[] = [
      { kind: 'taskDone', taskId: 'book-venue', on: '2026-13-45', amountInr: null, capacity: null },
      { kind: 'taskDelayed', taskId: 'book-decorator', notBefore: 'soon' },
    ];
    expect(progressFromOps(ops)).toEqual({ done: [], delays: [] });
  });

  it('feeds the scheduler the way the plan layer will', () => {
    const ops: Op[] = [
      {
        kind: 'taskDone',
        taskId: 'book-venue',
        on: '2026-10-31',
        amountInr: 180_000,
        capacity: 220,
      },
      { kind: 'taskDelayed', taskId: 'book-decorator', notBefore: '2026-11-10' },
    ];
    expect(scheduleFor(progressFromOps(ops))).toEqual(
      scheduleFor({ done: [VENUE_BOOKED], delays: [DECORATOR_DELAYED] }),
    );
  });
});
