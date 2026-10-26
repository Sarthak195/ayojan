import { describe, expect, it } from 'vitest';

import type { Category, MustHave } from '@/schemas/readings/vocabulary';

import { categoriesTiedToMustHaves } from '@/core/budget/must-have-categories';

import { taskRows } from './draft-data';

describe('categoriesTiedToMustHaves', () => {
  // Pinned by hand from data/tasks.yaml: each must-have activates one task in one category.
  it.each<[string, MustHave[], Category[]]>([
    ['no must-have', [], []],
    ['the dhol protects music', ['dhol'], ['music']],
    ['the mehndi artist protects decor', ['mehndiArtist'], ['decor']],
    ['the live counter protects catering', ['liveCounter'], ['catering']],
    ['the choreographer protects music', ['choreographer'], ['music']],
    ['two must-haves in one category list it once', ['dhol', 'choreographer'], ['music']],
    [
      'several must-haves list categories in vocabulary order',
      ['liveCounter', 'mehndiArtist', 'dhol'],
      ['catering', 'decor', 'music'],
    ],
  ])('%s', (_name, mustHaves, expected) => {
    expect(categoriesTiedToMustHaves(mustHaves, taskRows)).toEqual(expected);
  });

  it('follows the task data instead of a table in code', () => {
    const moved = taskRows.map((task) =>
      task.id === 'book-dhol-or-band' ? { ...task, category: 'venue' as const } : task,
    );
    expect(categoriesTiedToMustHaves(['dhol'], moved)).toEqual(['venue']);
  });
});
