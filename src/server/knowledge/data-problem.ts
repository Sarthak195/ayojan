import 'server-only';

export interface DataProblem {
  readonly fileName: string;
  /** Where in the file, e.g. `tasks[3] (book-caterer)`; null when the whole file is at fault. */
  readonly row: string | null;
  readonly message: string;
}

export function describeProblem(problem: DataProblem): string {
  const where = problem.row === null ? '' : `, row ${problem.row}`;
  return `data/${problem.fileName}${where}: ${problem.message}`;
}

/**
 * Thrown at boot when planning data is broken. The message names the file and the row, because
 * the person fixing it is editing YAML by hand and a bare Zod path does not say which task.
 */
export class DataFileError extends Error {
  readonly problems: readonly DataProblem[];

  constructor(problems: readonly DataProblem[]) {
    super(problems.map(describeProblem).join('\n'));
    this.name = 'DataFileError';
    this.problems = problems;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function child(node: unknown, part: string | number): unknown {
  if (Array.isArray(node) && typeof part === 'number') return node.at(part) as unknown;
  return isRecord(node) ? node[String(part)] : undefined;
}

// The fields that identify a row in each file, in the order they are tried.
const IDENTITY_FIELDS = ['id', 'category', 'priority'] as const;

function identity(row: unknown): string | null {
  if (!isRecord(row)) return null;
  for (const field of IDENTITY_FIELDS) {
    const value = row[field];
    if (typeof value === 'string') return value;
  }
  return null;
}

/** `tasks[3] (book-caterer)` for row 3 of the `tasks` list, read off the raw document. */
export function rowLabel(listPath: readonly (string | number)[], row: unknown): string {
  const label = listPath
    .map((part) => (typeof part === 'number' ? `[${String(part)}]` : `.${part}`))
    .join('')
    .replace(/^\./, '');
  const id = identity(row);
  return id === null ? label : `${label} (${id})`;
}

/**
 * Splits a Zod issue path at its last list index: the part up to it names the row, the rest
 * names the field inside the row.
 */
export function locate(
  document: unknown,
  path: readonly PropertyKey[],
): { row: string | null; field: string } {
  const parts = path.filter(
    (part): part is string | number => typeof part === 'string' || typeof part === 'number',
  );
  let lastIndex = -1;
  parts.forEach((part, index) => {
    if (typeof part === 'number') lastIndex = index;
  });
  if (lastIndex === -1) return { row: null, field: parts.join('.') };
  let node: unknown = document;
  for (const part of parts.slice(0, lastIndex + 1)) node = child(node, part);
  return {
    row: rowLabel(parts.slice(0, lastIndex + 1), node),
    field: parts.slice(lastIndex + 1).join('.'),
  };
}
