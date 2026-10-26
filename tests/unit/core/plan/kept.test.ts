import { describe, expect, it } from 'vitest';

import { decisionsOf, keptDecisions } from '@/core/plan/kept';
import { reconfirmations } from '@/core/plan/reconfirmation';

import { first, versionOf } from './plan-fixture';

const v5 = versionOf(first(5));
const v6 = versionOf(first(6));
const v7 = versionOf(first(7));
const v8 = versionOf(first(8));

describe('decision keys', () => {
  it('gives each decision of a version a stable key, in a fixed order', () => {
    expect(decisionsOf(v5).map((item) => item.key)).toEqual([
      'priority:venue',
      'priority:catering',
      'priority:decor',
      'priority:photo',
      'priority:music',
      'priority:invites',
      'priority:contingency',
      'mustHave:dhol',
      'need:wheelchair',
      'function:haldi',
      'function:mehndi',
      'function:sangeet',
      'function:wedding',
      'function:reception',
      'booking:venue',
      'quote:A',
      'quote:B',
      'taskEvent:book-decorator',
    ]);
  });

  it('adds a key per chosen lever, and lists a booking task once, as its booking', () => {
    const keys = decisionsOf(v7).map((item) => item.key);
    expect(keys).toContain('lever:e-invites');
    expect(keys).toContain('lever:half-contingency');
    expect(keys).not.toContain('taskEvent:book-venue');
  });
});

describe('Kept after the explainer change (D29)', () => {
  const kept = keptDecisions(v5, v6, reconfirmations(v6));

  it('keeps the venue booking and both quotes, but asks again', () => {
    expect(kept.keptAskAgain.map((item) => item.key)).toEqual([
      'booking:venue',
      'quote:A',
      'quote:B',
    ]);
  });

  it('keeps food priority, the dhol, the wheelchair need, functions and the decorator delay', () => {
    expect(kept.kept.map((item) => item.key)).toEqual(
      expect.arrayContaining([
        'priority:catering',
        'mustHave:dhol',
        'need:wheelchair',
        'function:mehndi',
        'taskEvent:book-decorator',
      ]),
    );
    expect(kept.changed).toEqual([]);
  });

  it('counts both lists, so the counter equals what the page lists', () => {
    expect(kept.counter).toEqual({
      kept: kept.kept.length + kept.keptAskAgain.length,
      total: decisionsOf(v5).length,
    });
    expect(kept.counter).toEqual({ kept: 18, total: 18 });
  });
});

describe('Kept after the second change', () => {
  const kept = keptDecisions(v7, v8, reconfirmations(v8));

  it('counts the food priority as changed and Move money as no decision change', () => {
    expect(kept.changed.map((item) => item.key)).toEqual(['priority:catering']);
    expect(kept.counter).toEqual({
      kept: decisionsOf(v7).length - 1,
      total: decisionsOf(v7).length,
    });
  });

  it('still asks the vendors the first change affected: nobody has confirmed them yet', () => {
    expect(kept.keptAskAgain.map((item) => item.key)).toEqual([
      'booking:venue',
      'quote:A',
      'quote:B',
    ]);
  });
});

describe('Kept of identical versions', () => {
  it('keeps every decision and adds none', () => {
    const kept = keptDecisions(v6, v6, []);
    expect(kept.changed).toEqual([]);
    expect(kept.added).toEqual([]);
    expect(kept.counter.kept).toBe(kept.counter.total);
  });

  it('reports decisions made since as added, outside the count', () => {
    const kept = keptDecisions(v6, v7, []);
    expect(kept.added.map((item) => item.key)).toEqual([
      'lever:e-invites',
      'lever:half-contingency',
    ]);
    expect(kept.counter.total).toBe(decisionsOf(v6).length);
  });
});
