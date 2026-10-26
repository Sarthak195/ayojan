import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { parse, stringify } from 'yaml';

import { DataFileError } from '@/server/knowledge/data-problem';
import {
  createKnowledgeRepository,
  knowledge,
  parseDataFile,
  readFromDirectory,
} from '@/server/knowledge/repository';

const DATA = join(process.cwd(), 'data');
const realText = readFromDirectory(DATA);

function brokenRepository(fileName: string, text: string) {
  return createKnowledgeRepository((name) => (name === fileName ? text : realText(name)));
}

describe('repository', () => {
  it('loads every committed data file and passes the cross-file checks', () => {
    const documents = createKnowledgeRepository(realText).all();
    expect(documents.tasks.tasks.length).toBeGreaterThanOrEqual(16);
    expect(documents.budgetWeights.profiles.map((profile) => profile.id)).toEqual([
      'wedding',
      'celebration',
    ]);
  });

  it('reads a file only on first use, and only once for many requests', () => {
    const read = vi.fn(realText);
    const repository = createKnowledgeRepository(read);
    expect(read).not.toHaveBeenCalled();
    for (let request = 0; request < 5; request += 1) repository.get('tasks');
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith('tasks.yaml');
    for (let request = 0; request < 5; request += 1) repository.all();
    expect(read).toHaveBeenCalledTimes(5);
  });

  it('is held on globalThis, so every route bundle shares one instance', () => {
    expect(knowledge()).toBe(knowledge());
    expect(knowledge().get('levers').levers.length).toBeGreaterThan(0);
  });

  it('rejects a deliberately broken document, naming the file and the row', () => {
    const tasks = parse(realText('tasks.yaml')) as { tasks: { hi: string }[] };
    const second = tasks.tasks[1];
    if (second === undefined) throw new Error('fixture needs two tasks');
    second.hi = '';
    const repository = brokenRepository('tasks.yaml', stringify(tasks));
    expect(() => repository.get('tasks')).toThrow(DataFileError);
    expect(() => repository.get('tasks')).toThrow(
      /data\/tasks\.yaml, row tasks\[1\] \(book-caterer\): hi: Hindi text is missing\./,
    );
  });

  it('names the file when the YAML itself does not parse', () => {
    expect(() => parseDataFile('levers', 'levers: [unclosed')).toThrow(
      /data\/levers\.yaml: Not valid YAML/,
    );
  });

  it('refuses duplicate keys, so a second hi cannot silently replace the first', () => {
    const text = realText('functions.yaml').replace('hi: हल्दी', 'hi: हल्दी\n    hi: हल्दी');
    expect(() => parseDataFile('functions', text)).toThrow(/data\/functions\.yaml/);
  });

  it('does not hold a failed load, so a fixed file is read again', () => {
    let text = 'functions: [';
    const repository = createKnowledgeRepository((name) =>
      name === 'functions.yaml' ? text : realText(name),
    );
    expect(() => repository.get('functions')).toThrow(DataFileError);
    text = readFileSync(join(DATA, 'functions.yaml'), 'utf8');
    expect(repository.get('functions').functions).toHaveLength(5);
  });

  it('reports a cross-file fault from all(), naming the file', () => {
    const functions = parse(realText('functions.yaml')) as { functions: { tasks: string[] }[] };
    const first = functions.functions[0];
    if (first === undefined) throw new Error('fixture needs a function');
    first.tasks = [];
    const repository = brokenRepository('functions.yaml', stringify(functions));
    expect(() => repository.get('functions')).not.toThrow();
    expect(() => repository.all()).toThrow(/data\/functions\.yaml, row functions\[0\] \(haldi\)/);
  });
});
