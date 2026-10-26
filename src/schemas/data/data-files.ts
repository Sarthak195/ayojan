import type { z } from 'zod';

import { BudgetWeightsFile } from './budget-weights';
import { FunctionsFile } from './functions';
import { LeversFile } from './levers';
import { TasksFile } from './tasks';
import { VendorQuestionsFile } from './vendor-questions';

// The registry of planning data: one YAML file per key, each parsed through its schema.
export const dataFiles = {
  budgetWeights: { fileName: 'budget-weights.yaml', schema: BudgetWeightsFile },
  tasks: { fileName: 'tasks.yaml', schema: TasksFile },
  levers: { fileName: 'levers.yaml', schema: LeversFile },
  vendorQuestions: { fileName: 'vendor-questions.yaml', schema: VendorQuestionsFile },
  functions: { fileName: 'functions.yaml', schema: FunctionsFile },
} as const;

export type DataFileKey = keyof typeof dataFiles;

// Spelled out in load order rather than read from Object.keys, which would need a cast.
export const dataFileKeys: readonly DataFileKey[] = [
  'budgetWeights',
  'tasks',
  'levers',
  'vendorQuestions',
  'functions',
];

export type DataDocument<K extends DataFileKey> = z.infer<(typeof dataFiles)[K]['schema']>;

export type DataDocuments = { readonly [K in DataFileKey]: DataDocument<K> };
