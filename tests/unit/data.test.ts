// Data change pinned here: the 2026-10-26 review stamped every reviewed field, so the sign-off
// test swaps whatever stamp the first row carries instead of an empty string.
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import { BASIS_PREFIX } from '@/schemas/data/planning-row';
import { Category, Diet, MustHave, Occasion, VenueLimit } from '@/schemas/readings/vocabulary';
import { absoluteRupeeProblems } from '@/server/knowledge/absolute-rupees';
import { createKnowledgeRepository, readFromDirectory } from '@/server/knowledge/repository';

const realText = readFromDirectory(join(process.cwd(), 'data'));
const documents = createKnowledgeRepository(realText).all();
const { tasks, levers, vendorQuestions, functions, budgetWeights } = documents;
const FILES = [
  'budget-weights.yaml',
  'tasks.yaml',
  'levers.yaml',
  'vendor-questions.yaml',
  'functions.yaml',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Every object in a document that carries a basis is a data row.
function rows(node: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) for (const child of node) rows(child, found);
  else if (isRecord(node)) {
    if ('basis' in node) found.push(node);
    for (const child of Object.values(node)) rows(child, found);
  }
  return found;
}

const allRows = rows(documents);

describe('referential-integrity', () => {
  const taskIds = tasks.tasks.map((task) => task.id);

  it('has unique ids in every file', () => {
    for (const ids of [
      taskIds,
      levers.levers.map((lever) => lever.id),
      vendorQuestions.questions.map((question) => question.id),
      functions.functions.map((row) => row.id),
    ]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('has every depends-on id pointing at a real task', () => {
    for (const task of tasks.tasks) {
      for (const dependency of task.dependsOn) expect(taskIds).toContain(dependency);
    }
  });

  it('has no dependency cycle (every task can be ordered)', () => {
    const ordered: string[] = [];
    let remaining = [...tasks.tasks];
    while (remaining.length > 0) {
      const ready = remaining.filter((task) => task.dependsOn.every((id) => ordered.includes(id)));
      expect(ready.length).toBeGreaterThan(0);
      ordered.push(...ready.map((task) => task.id));
      remaining = remaining.filter((task) => !ready.includes(task));
    }
    expect(ordered).toHaveLength(taskIds.length);
  });

  it('has every lever and question naming a real category', () => {
    for (const lever of levers.levers) {
      if (lever.effect !== 'raiseBudget') expect(Category.options).toContain(lever.category);
    }
    for (const question of vendorQuestions.questions) {
      for (const category of question.categories) expect(Category.options).toContain(category);
    }
  });

  it('maps every must-have to a task, and through it to a category', () => {
    for (const item of MustHave.options) {
      const task = tasks.tasks.find((candidate) =>
        candidate.activatedBy.some((when) => when.when === 'mustHave' && when.mustHave === item),
      );
      expect(task, item).toBeDefined();
      expect(Category.options).toContain(task?.category);
    }
  });

  it('asks a vendor question for every diet and venue limit (D14)', () => {
    const raised = vendorQuestions.questions.map((question) => question.raisedBy);
    for (const diet of Diet.options) {
      expect(
        raised.some((by) => by.when === 'diet' && by.diet === diet),
        diet,
      ).toBe(true);
    }
    for (const limit of VenueLimit.options) {
      expect(raised.some((by) => by.when === 'venueLimit' && by.venueLimit === limit)).toBe(true);
    }
  });

  it('lists each function with exactly the tasks it activates', () => {
    for (const row of functions.functions) {
      const activated = tasks.tasks
        .filter((task) =>
          task.activatedBy.some((w) => w.when === 'function' && w.function === row.id),
        )
        .map((task) => task.id);
      expect([...row.tasks].sort()).toEqual(activated.sort());
    }
  });

  it('points the e-invites lever at a task that has a faster alternative', () => {
    for (const lever of levers.levers) {
      if (lever.effect !== 'percentOfCategory' || lever.fasterAlternativeFor === null) continue;
      const task = tasks.tasks.find((candidate) => candidate.id === lever.fasterAlternativeFor);
      expect(task?.fasterAlternative).not.toBeNull();
    }
  });

  it('gives both profiles all seven categories and contingency a floor of the budget', () => {
    for (const profile of budgetWeights.profiles) {
      expect(profile.categories.map((row) => row.category)).toEqual(Category.options);
      const contingency = profile.categories.find((row) => row.category === 'contingency');
      expect(contingency?.floor).toEqual({ of: 'budget', percent: 5 });
    }
  });

  it('maps every occasion to exactly one profile, the wedding alone to the wedding profile (D38)', () => {
    const profileOf = budgetWeights.profiles.flatMap((profile) =>
      profile.occasions.map((occasion) => [occasion, profile.id] as const),
    );
    expect(profileOf.map(([occasion]) => occasion).sort()).toEqual([...Occasion.options].sort());
    for (const [occasion, profile] of profileOf) {
      expect(profile).toBe(occasion === 'wedding' ? 'wedding' : 'celebration');
    }
  });

  it('has en and hi on every row, with the Hindi in Devanagari', () => {
    expect(allRows.length).toBeGreaterThan(60);
    // A task's celebration timing (D40) is two numbers and a basis; its words are the task's.
    const timings = new Set<unknown>(tasks.tasks.map((task) => task.celebration));
    for (const row of allRows.filter((candidate) => !timings.has(candidate))) {
      expect(typeof row.en === 'string' && row.en.length > 0, JSON.stringify(row)).toBe(true);
      expect(typeof row.hi === 'string' && /[ऀ-ॿ]/.test(row.hi)).toBe(true);
    }
  });

  it("states every basis as the author's assumption, never a source, with a reviewed field to sign", () => {
    for (const row of allRows) {
      expect(String(row.basis).startsWith(BASIS_PREFIX)).toBe(true);
      expect(String(row.basis)).not.toMatch(/https?:|www\.|survey|report|study|according to/i);
      // Empty until the user signs the row off; a sign-off must not turn CI red.
      expect(typeof row.reviewed).toBe('string');
    }
  });
});

describe('no-absolute-rupees', () => {
  it.each(FILES)('%s holds no rupee word and no number of four or more digits', (fileName) => {
    expect(absoluteRupeeProblems(fileName, realText(fileName))).toEqual([]);
  });

  it.each([
    'percent: 45000',
    'basis: costs Rs 50,000',
    'en: about 2 lakh',
    'hi: लगभग दो लाख',
    'hi: ₹ 500',
    'basis: 1,90,000 for food',
  ])('refuses "%s"', (line) => {
    expect(absoluteRupeeProblems('levers.yaml', line)).toHaveLength(1);
  });

  it('allows a sign-off date in reviewed, so signing a row off cannot break boot', () => {
    expect(absoluteRupeeProblems('tasks.yaml', "    reviewed: 'SK 2026-10-27'")).toEqual([]);
    const signed = realText('functions.yaml').replace(/reviewed: .*/, "reviewed: 'SK 2026-10-27'");
    const repository = createKnowledgeRepository((name) =>
      name === 'functions.yaml' ? signed : realText(name),
    );
    expect(repository.all().functions.functions[0]?.reviewed).toBe('SK 2026-10-27');
  });
});

type Mutation = (document: Record<string, unknown[]>) => void;

function rowsOf(document: Record<string, unknown[]>, list: string): Record<string, unknown>[] {
  return (document[list] ?? []).filter(isRecord);
}

function byId(
  document: Record<string, unknown[]>,
  list: string,
  id: string,
): Record<string, unknown> {
  const row = rowsOf(document, list).find((candidate) => candidate.id === id);
  if (row === undefined) throw new Error(`fixture needs ${id}`);
  return row;
}

function loadWith(fileName: string, mutate: Mutation): () => unknown {
  const document = parse(realText(fileName)) as Record<string, unknown[]>;
  mutate(document);
  const broken = stringify(document);
  const repository = createKnowledgeRepository((name) =>
    name === fileName ? broken : realText(name),
  );
  return () => repository.all();
}

// The planted faults of the test plan's invalid-data list, built from the committed files so
// each stays a copy of a valid file with exactly one fault, however the data evolves.
const plantedFaults: readonly [string, string, Mutation, RegExp][] = [
  [
    'celebration-timing-missing',
    'tasks.yaml',
    (d) => {
      byId(d, 'tasks', 'book-venue').celebration = null;
    },
    /row tasks\[0\] \(book-venue\): celebration is missing/,
  ],
  [
    'celebration-timing-on-a-wedding-only-task',
    'tasks.yaml',
    (d) => {
      byId(d, 'tasks', 'mandap-design').celebration = byId(d, 'tasks', 'book-venue').celebration;
    },
    /\(mandap-design\): A wedding-only task must have celebration: null/,
  ],
  [
    'celebration-lead-longer-than-the-wedding',
    'tasks.yaml',
    (d) => {
      const row = byId(d, 'tasks', 'final-headcount');
      row.celebration = { ...(row.celebration as object), latestFinishDaysBefore: 30 };
    },
    /\(final-headcount\): celebration\.latestFinishDaysBefore is longer than the wedding's/,
  ],
  [
    'celebration-faster-alternative-missing',
    'tasks.yaml',
    (d) => {
      const row = byId(d, 'tasks', 'print-invitations');
      row.fasterAlternative = { ...(row.fasterAlternative as object), celebration: null };
    },
    /\(print-invitations\): fasterAlternative\.celebration is missing/,
  ],
  [
    'tasks-cycle',
    'tasks.yaml',
    (d) => {
      byId(d, 'tasks', 'book-venue').dependsOn = ['book-caterer'];
    },
    /row tasks\[\d+\] \(.+\): Dependency cycle among: .*book-venue/,
  ],
  [
    'tasks-self-loop',
    'tasks.yaml',
    (d) => {
      byId(d, 'tasks', 'book-venue').dependsOn = ['book-venue'];
    },
    /row tasks\[0\] \(book-venue\): The task depends on itself/,
  ],
  [
    'tasks-three-cycle',
    'tasks.yaml',
    (d) => {
      byId(d, 'tasks', 'book-venue').dependsOn = ['decor-sign-off'];
    },
    /Dependency cycle among: .*decor-sign-off/,
  ],
  [
    'tasks-duplicate-id',
    'tasks.yaml',
    (d) => {
      byId(d, 'tasks', 'book-caterer').id = 'book-venue';
    },
    /row tasks\[1\] \(book-venue\): Id "book-venue" is used twice/,
  ],
  [
    'tasks-duplicate-dependency',
    'tasks.yaml',
    (d) => {
      byId(d, 'tasks', 'final-walkthrough').dependsOn = ['book-caterer', 'book-caterer'];
    },
    /\(final-walkthrough\): dependsOn names "book-caterer" twice/,
  ],
  [
    'tasks-unknown-dependency',
    'tasks.yaml',
    (d) => {
      byId(d, 'tasks', 'menu-tasting').dependsOn = ['book-astrologer'];
    },
    /\(menu-tasting\): dependsOn names "book-astrologer", which is not a task id/,
  ],
  [
    'tasks-missing-hi',
    'tasks.yaml',
    (d) => {
      delete byId(d, 'tasks', 'return-gifts').hi;
    },
    /\(return-gifts\): hi: /,
  ],
  [
    'levers-missing-hi',
    'levers.yaml',
    (d) => {
      byId(d, 'levers', 'leaner-photo').consequence = { en: 'One crew.', hi: '' };
    },
    /levers\.yaml, row levers\[2\] \(leaner-photo\): consequence\.hi: Hindi text is missing/,
  ],
  [
    'levers-unknown-category',
    'levers.yaml',
    (d) => {
      byId(d, 'levers', 'simpler-decor').category = 'jewellery';
    },
    /levers\.yaml, row levers\[0\] \(simpler-decor\): category: /,
  ],
  [
    'musthave-without-task',
    'tasks.yaml',
    (d) => {
      byId(d, 'tasks', 'book-choreographer').activatedBy = [{ when: 'always' }];
    },
    /tasks\.yaml: No task is activated by the must-have "choreographer"/,
  ],
  [
    'weights-negative',
    'budget-weights.yaml',
    (d) => {
      const wedding = rowsOf(d, 'profiles')[0];
      const venue = (wedding?.categories as unknown[] | undefined)?.find(isRecord);
      if (venue) venue.baseWeight = -5;
    },
    /budget-weights\.yaml, row profiles\[0\]\.categories\[0\] \(venue\): baseWeight: /,
  ],
  [
    'weights-missing-category',
    'budget-weights.yaml',
    (d) => {
      const wedding = rowsOf(d, 'profiles')[0];
      if (wedding) wedding.categories = (wedding.categories as unknown[]).slice(1);
    },
    /budget-weights\.yaml, row profiles\[0\] \(wedding\)\.categories: "venue" is missing/,
  ],
  [
    'occasion-in-two-profiles',
    'budget-weights.yaml',
    (d) => {
      const wedding = rowsOf(d, 'profiles')[0];
      if (wedding) wedding.occasions = ['wedding', 'puja'];
    },
    /budget-weights\.yaml, row profiles\.occasions: "puja" appears twice/,
  ],
  [
    'data-absolute-rupee',
    'levers.yaml',
    (d) => {
      byId(d, 'levers', 'simpler-menu').basis =
        `${BASIS_PREFIX}a menu change saves about Rs 45,000.`;
    },
    /levers\.yaml, row line \d+: Looks like an absolute rupee amount/,
  ],
  [
    'row-missing-basis',
    'vendor-questions.yaml',
    (d) => {
      byId(d, 'questions', 'tax-rate').basis = '';
    },
    /vendor-questions\.yaml, row questions\[0\] \(tax-rate\): basis: The basis must read/,
  ],
  [
    'basis-citing-a-survey',
    'functions.yaml',
    (d) => {
      byId(d, 'functions', 'mehndi').basis = `${BASIS_PREFIX}a wedding survey says so.`;
    },
    /functions\.yaml, row functions\[1\] \(mehndi\): basis: The basis must not cite/,
  ],
  [
    'hindi-in-latin-script',
    'functions.yaml',
    (d) => {
      byId(d, 'functions', 'sangeet').hi = 'Sangeet';
    },
    /\(sangeet\): hi: Hindi text must be written in Devanagari/,
  ],
  [
    'unknown-field',
    'tasks.yaml',
    (d) => {
      byId(d, 'tasks', 'book-venue').costInr = 5;
    },
    /\(book-venue\): .*costInr/,
  ],
  [
    'question-placeholder-mismatch',
    'vendor-questions.yaml',
    (d) => {
      byId(d, 'questions', 'venue-capacity').hi = 'मेहमान अब {guests} हैं।';
    },
    /\(venue-capacity\): hi: The Hindi text must use the same placeholders/,
  ],
];

describe('invalid-data', () => {
  it.each(plantedFaults)(
    '%s is rejected naming the file and the row',
    (_name, fileName, mutate, expected) => {
      const load = loadWith(fileName, mutate);
      expect(load).toThrow(new RegExp(`data/${fileName.replace('.', '\\.')}`));
      expect(load).toThrow(expected);
    },
  );
});
