import { describe, expect, it } from 'vitest';

import { orderTasks } from '@/core/timeline/dependency-order';
import type { GraphReason } from '@/core/timeline/dependency-order';
import { resolveTask } from '@/core/timeline/task-selection';
import type { ResolvedTask } from '@/core/timeline/task-selection';

import { tasksFile } from './planning-fixture';

function node(id: string, dependsOn: string[] = []): ResolvedTask {
  return {
    id,
    category: 'venue',
    en: id,
    hi: id,
    dependsOn,
    latestFinishDaysBefore: 10,
    durationDays: 1,
    books: null,
    fasterApplied: false,
  };
}

function knownTo(tasks: readonly ResolvedTask[], extra: string[] = []): Set<string> {
  return new Set([...tasks.map((task) => task.id), ...extra]);
}

function idsOf(tasks: readonly ResolvedTask[], extra: string[] = []): string[] {
  const result = orderTasks(tasks, knownTo(tasks, extra));
  if (!result.ok) throw new Error(`refused: ${result.problem.reason}`);
  return result.value.order.map((task) => task.id);
}

describe('topological order', () => {
  it.each<[string, ResolvedTask[], string[]]>([
    ['a single task', [node('a')], ['a']],
    ['no tasks', [], []],
    ['a chain given backwards', [node('c', ['b']), node('b', ['a']), node('a')], ['a', 'b', 'c']],
    [
      'a disconnected graph, ties by data order',
      [node('x'), node('y', ['x']), node('z')],
      ['x', 'y', 'z'],
    ],
    [
      'a dependant listed after an unrelated task',
      [node('x'), node('z'), node('y', ['x'])],
      ['x', 'z', 'y'],
    ],
    [
      'a diamond',
      [node('top'), node('left', ['top']), node('right', ['top']), node('join', ['left', 'right'])],
      ['top', 'left', 'right', 'join'],
    ],
    [
      'two independent chains, interleaved by data order',
      [node('a1'), node('b1'), node('a2', ['a1']), node('b2', ['b1'])],
      ['a1', 'b1', 'a2', 'b2'],
    ],
  ])('orders %s', (_label, tasks, expected) => {
    expect(idsOf(tasks)).toEqual(expected);
  });

  it('gives the same answer for the same input twice', () => {
    const tasks = [node('c', ['a']), node('a'), node('b', ['a', 'c'])];
    expect(idsOf(tasks)).toEqual(idsOf(tasks));
  });

  it('puts every dependency before its dependant, whatever order the data lists them in', () => {
    const everyTask = tasksFile.tasks.map((row) => resolveTask(row, false));
    for (const tasks of [everyTask, [...everyTask].reverse()]) {
      const order = idsOf(tasks);
      expect(order).toHaveLength(tasks.length);
      for (const task of tasks) {
        for (const dependency of task.dependsOn) {
          expect(order.indexOf(dependency)).toBeLessThan(order.indexOf(task.id));
        }
      }
    }
  });
});

describe('dependencies on tasks outside the plan', () => {
  it('counts a dropped template as satisfied and removes it from the dependencies', () => {
    const tasks = [node('walkthrough', ['mandap', 'caterer']), node('caterer')];
    const result = orderTasks(tasks, knownTo(tasks, ['mandap']));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.dependencies.get('walkthrough')).toEqual(['caterer']);
  });
});

describe('refusals', () => {
  function problemOf(tasks: ResolvedTask[]) {
    const result = orderTasks(tasks, knownTo(tasks));
    if (result.ok) throw new Error('expected a refusal');
    return result.problem;
  }

  it.each<[string, ResolvedTask[], GraphReason, string[]]>([
    ['a self-loop', [node('a', ['a'])], 'cycle', ['a']],
    ['a two-task cycle', [node('a', ['b']), node('b', ['a'])], 'cycle', ['a', 'b']],
    [
      'a three-task cycle',
      [node('a', ['c']), node('b', ['a']), node('c', ['b'])],
      'cycle',
      ['a', 'b', 'c'],
    ],
    [
      'a cycle behind an innocent task, naming only the cycle',
      [node('ok'), node('x', ['ok', 'y']), node('y', ['x'])],
      'cycle',
      ['x', 'y'],
    ],
    ['a duplicate task id', [node('a'), node('a')], 'duplicate-task', ['a']],
    [
      'a duplicate dependency entry',
      [node('a'), node('b', ['a', 'a'])],
      'duplicate-dependency',
      ['b', 'a'],
    ],
  ])('refuses %s', (_label, tasks, reason, blamed) => {
    const problem = problemOf(tasks);
    expect(problem.reason).toBe(reason);
    expect([...problem.taskIds].sort()).toEqual([...blamed].sort());
  });

  it('refuses an id that is not in the data at all, unlike one that is merely inactive', () => {
    const tasks = [node('a', ['typo'])];
    expect(problemOf(tasks)).toEqual({ reason: 'unknown-dependency', taskIds: ['a', 'typo'] });
    expect(idsOf(tasks, ['typo'])).toEqual(['a']);
  });

  it('lists a cycle in dependency order, each task waiting on the next', () => {
    const problem = problemOf([node('a', ['b']), node('b', ['c']), node('c', ['a'])]);
    expect(problem.taskIds).toEqual(['a', 'b', 'c']);
  });
});
