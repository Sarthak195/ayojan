import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';
import type { z } from 'zod';

import {
  dataFiles,
  type DataDocument,
  type DataDocuments,
  type DataFileKey,
} from '@/schemas/data/data-files';

import { absoluteRupeeProblems } from './absolute-rupees';
import { crossFileProblems } from './cross-file-integrity';
import { DataFileError, locate, type DataProblem } from './data-problem';
import {
  budgetWeightProblems,
  functionProblems,
  leverProblems,
  questionProblems,
  taskProblems,
} from './integrity';

/** Returns the text of one data file by its name, e.g. `tasks.yaml`. */
export type ReadDataText = (fileName: string) => string;

export interface KnowledgeRepository {
  /** One file, parsed and checked on first use, then held. */
  get<K extends DataFileKey>(key: K): DataDocument<K>;
  /** Every file, plus the checks that span files: the boot validator. */
  all(): DataDocuments;
}

function parseYaml(fileName: string, text: string): unknown {
  try {
    // Duplicate keys would let a later `hi:` silently replace an earlier one.
    return parse(text, { uniqueKeys: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DataFileError([{ fileName, row: null, message: `Not valid YAML: ${reason}` }]);
  }
}

function parseWith<T>(
  fileName: string,
  schema: z.ZodType<T>,
  check: (document: T) => DataProblem[],
  text: string,
): T {
  const rupees = absoluteRupeeProblems(fileName, text);
  if (rupees.length > 0) throw new DataFileError(rupees);
  const raw = parseYaml(fileName, text);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new DataFileError(
      result.error.issues.map((issue) => {
        const { row, field } = locate(raw, issue.path);
        return {
          fileName,
          row,
          message: field === '' ? issue.message : `${field}: ${issue.message}`,
        };
      }),
    );
  }
  const problems = check(result.data);
  if (problems.length > 0) throw new DataFileError(problems);
  return result.data;
}

const parsers: { readonly [K in DataFileKey]: (text: string) => DataDocument<K> } = {
  budgetWeights: (text) =>
    parseWith(
      dataFiles.budgetWeights.fileName,
      dataFiles.budgetWeights.schema,
      budgetWeightProblems,
      text,
    ),
  tasks: (text) => parseWith(dataFiles.tasks.fileName, dataFiles.tasks.schema, taskProblems, text),
  levers: (text) =>
    parseWith(dataFiles.levers.fileName, dataFiles.levers.schema, leverProblems, text),
  vendorQuestions: (text) =>
    parseWith(
      dataFiles.vendorQuestions.fileName,
      dataFiles.vendorQuestions.schema,
      questionProblems,
      text,
    ),
  functions: (text) =>
    parseWith(dataFiles.functions.fileName, dataFiles.functions.schema, functionProblems, text),
};

/** Parses one data file's text through its schema and its row checks; throws naming file and row. */
export function parseDataFile<K extends DataFileKey>(key: K, text: string): DataDocument<K> {
  const parser: (text: string) => DataDocument<K> = parsers[key];
  return parser(text);
}

// Runs `load` on the first call and returns the same value afterwards. A failed load is not
// held, so a fixed file is picked up on the next call instead of failing forever.
function once<T>(load: () => T): () => T {
  let held: { readonly value: T } | null = null;
  return () => (held ??= { value: load() }).value;
}

export function createKnowledgeRepository(read: ReadDataText): KnowledgeRepository {
  const load = <K extends DataFileKey>(key: K) =>
    once(() => parseDataFile(key, read(dataFiles[key].fileName)));
  const getters: { readonly [K in DataFileKey]: () => DataDocument<K> } = {
    budgetWeights: load('budgetWeights'),
    tasks: load('tasks'),
    levers: load('levers'),
    vendorQuestions: load('vendorQuestions'),
    functions: load('functions'),
  };
  let checked: DataDocuments | null = null;

  function get<K extends DataFileKey>(key: K): DataDocument<K> {
    const getter: () => DataDocument<K> = getters[key];
    return getter();
  }

  function all(): DataDocuments {
    if (checked !== null) return checked;
    const documents: DataDocuments = {
      budgetWeights: get('budgetWeights'),
      tasks: get('tasks'),
      levers: get('levers'),
      vendorQuestions: get('vendorQuestions'),
      functions: get('functions'),
    };
    const problems = crossFileProblems(documents);
    if (problems.length > 0) throw new DataFileError(problems);
    checked = documents;
    return documents;
  }

  return { get, all };
}

export function readFromDirectory(directory: string): ReadDataText {
  return (fileName) => readFileSync(join(directory, fileName), 'utf8');
}

const HOLDER = Symbol.for('ayojan.knowledge');
type KnowledgeHolder = typeof globalThis & { [HOLDER]?: KnowledgeRepository };

/**
 * The repository over `data/`, created once per process. Held on globalThis because Next
 * bundles each route separately, and a module-level variable would exist once per bundle and
 * load the files again for each.
 */
export function knowledge(): KnowledgeRepository {
  const holder: KnowledgeHolder = globalThis;
  const held = holder[HOLDER];
  if (held !== undefined) return held;
  const created = createKnowledgeRepository(readFromDirectory(join(process.cwd(), 'data')));
  holder[HOLDER] = created;
  return created;
}
