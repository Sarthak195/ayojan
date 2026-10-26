// Data changes pinned here (2026-10-26 review): book-dhol-or-band is always on, so dhol no
// longer adds it; book-mehndi-artist is no longer wedding-only, so a celebration keeps it.
import { describe, expect, it } from 'vitest';

import { resolveTask, selectTasks } from '@/core/timeline/task-selection';
import type { TaskNeeds } from '@/core/timeline/task-selection';

import { NOTHING_EXTRA, PERSONA, tasksFile, templateOf } from './planning-fixture';

function idsFor(needs: TaskNeeds, profile: 'wedding' | 'celebration' = 'wedding'): string[] {
  return selectTasks(tasksFile.tasks, needs, profile).active.map((row) => row.id);
}

const everyWeddingTask = tasksFile.tasks
  .filter((row) => row.activatedBy.some((rule) => rule.when === 'always'))
  .map((row) => row.id);

describe('which templates are active', () => {
  it('keeps every always-on template when the brief adds nothing', () => {
    expect(idsFor(NOTHING_EXTRA)).toEqual(everyWeddingTask);
  });

  // The task ids below are pinned by hand from data/tasks.yaml; the activation rules are read
  // from the data, so a changed rule in the file fails the row it belongs to.
  it.each<[string, TaskNeeds, string]>([
    ['a mehndi function', { ...NOTHING_EXTRA, functions: { mehndi: 'yes' } }, 'book-mehndi-artist'],
    [
      'a sangeet function',
      { ...NOTHING_EXTRA, functions: { sangeet: 'yes' } },
      'sangeet-programme',
    ],
    ['a haldi function', { ...NOTHING_EXTRA, functions: { haldi: 'yes' } }, 'haldi-arrangements'],
    ['a live counter', { ...NOTHING_EXTRA, mustHaves: ['liveCounter'] }, 'confirm-live-counter'],
    ['a choreographer', { ...NOTHING_EXTRA, mustHaves: ['choreographer'] }, 'book-choreographer'],
    [
      'the mehndi artist as a must-have',
      { ...NOTHING_EXTRA, mustHaves: ['mehndiArtist'] },
      'book-mehndi-artist',
    ],
    ['a wheelchair user', { ...NOTHING_EXTRA, needs: ['wheelchair'] }, 'confirm-step-free-access'],
  ])('adds %s', (_label, needs, taskId) => {
    expect(idsFor(NOTHING_EXTRA)).not.toContain(taskId);
    expect(idsFor(needs)).toContain(taskId);
  });

  it('books music for every plan and still ties the dhol must-have to that task', () => {
    expect(idsFor(NOTHING_EXTRA)).toContain('book-dhol-or-band');
    const music = templateOf('book-dhol-or-band');
    expect(music.activatedBy).toContainEqual({ when: 'mustHave', mustHave: 'dhol' });
  });

  it.each<['no' | 'unsure']>([['no'], ['unsure']])(
    'does not add a function the family answered %s',
    (answer) => {
      expect(idsFor({ ...NOTHING_EXTRA, functions: { mehndi: answer, sangeet: answer } })).toEqual(
        everyWeddingTask,
      );
    },
  );

  it('lists a task once when two of its conditions hold', () => {
    const both: TaskNeeds = {
      ...NOTHING_EXTRA,
      functions: { mehndi: 'yes' },
      mustHaves: ['mehndiArtist'],
    };
    expect(idsFor(both).filter((id) => id === 'book-mehndi-artist')).toHaveLength(1);
  });

  it('keeps the order of the data file', () => {
    const order = tasksFile.tasks.map((row) => row.id);
    const chosen = idsFor(PERSONA);
    expect(chosen).toEqual(order.filter((id) => chosen.includes(id)));
  });

  it('gives the persona the tasks her brief activates and not the haldi she declined', () => {
    const chosen = idsFor(PERSONA);
    expect(chosen).toEqual(
      expect.arrayContaining([
        'book-dhol-or-band',
        'book-mehndi-artist',
        'sangeet-programme',
        'confirm-step-free-access',
      ]),
    );
    expect(chosen).not.toContain('haldi-arrangements');
  });
});

describe('the small-celebration profile', () => {
  const everything: TaskNeeds = {
    functions: { haldi: 'yes', mehndi: 'yes', sangeet: 'yes' },
    mustHaves: ['dhol', 'mehndiArtist', 'liveCounter', 'choreographer'],
    needs: ['wheelchair', 'elderly', 'children'],
  };

  it('drops every wedding-only template, even when the brief names the function', () => {
    const chosen = selectTasks(tasksFile.tasks, everything, 'celebration').active;
    expect(chosen.some((row) => row.weddingOnly)).toBe(false);
    const ids = chosen.map((row) => row.id);
    for (const dropped of ['mandap-design', 'haldi-arrangements', 'sangeet-programme']) {
      expect(ids).not.toContain(dropped);
    }
  });

  it('keeps the templates that are not wedding-only, including a dhol for a birthday', () => {
    const chosen = idsFor(everything, 'celebration');
    expect(chosen).toContain('book-dhol-or-band');
    expect(chosen).toContain('book-mehndi-artist');
    expect(chosen).toContain('book-venue');
    expect(chosen).toEqual(
      tasksFile.tasks
        .filter((row) => !row.weddingOnly)
        .map((row) => row.id)
        .filter((id) => chosen.includes(id)),
    );
  });

  it('still knows the dropped templates, so a dependency on one is not a typo', () => {
    const { knownIds } = selectTasks(tasksFile.tasks, everything, 'celebration');
    expect(knownIds.has('mandap-design')).toBe(true);
    expect(knownIds.size).toBe(tasksFile.tasks.length);
  });
});

describe('edge cases', () => {
  it('returns an empty list when no template is active', () => {
    expect(selectTasks([], PERSONA, 'wedding').active).toEqual([]);
    const weddingOnly = tasksFile.tasks.filter((row) => row.weddingOnly);
    expect(selectTasks(weddingOnly, PERSONA, 'celebration').active).toEqual([]);
  });
});

describe('the faster alternative', () => {
  it('swaps the name and the two day counts and nothing else', () => {
    const row = templateOf('print-invitations');
    const faster = row.fasterAlternative;
    if (faster === null) throw new Error('print-invitations should have a faster alternative');
    const slow = resolveTask(row, false);
    const quick = resolveTask(row, true);
    expect(slow).toMatchObject({
      en: row.en,
      latestFinishDaysBefore: row.latestFinishDaysBefore,
      durationDays: row.durationDays,
      fasterApplied: false,
    });
    expect(quick).toMatchObject({
      en: faster.en,
      hi: faster.hi,
      latestFinishDaysBefore: faster.latestFinishDaysBefore,
      durationDays: faster.durationDays,
      fasterApplied: true,
    });
    expect(quick.dependsOn).toEqual(row.dependsOn);
    expect(quick.books).toBe(row.books);
  });

  it('leaves a task with no alternative unchanged when asked for one', () => {
    const row = templateOf('book-venue');
    expect(resolveTask(row, true)).toEqual(resolveTask(row, false));
  });
});
