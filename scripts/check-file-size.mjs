#!/usr/bin/env node
// Fails when a source file exceeds the line cap. Long files are where unrelated
// responsibilities pile up, so the cap is enforced rather than suggested. Tests are exempt:
// a table-driven test is long because it is exhaustive.

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const MAX_LINES = 250;
const ROOTS = ['src', 'scripts'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.mjs']);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return EXTENSIONS.has(extname(path)) ? [path] : [];
  });
}

// Counts newline characters, exactly like `wc -l`. Splitting on newlines and keeping the
// empty tail would report one line more than every other tool for a well-formed file.
function countLines(contents) {
  return contents.split('\n').length - 1;
}

function existingRoots() {
  return ROOTS.filter((root) => {
    try {
      readdirSync(root);
      return true;
    } catch {
      return false;
    }
  });
}

const offenders = existingRoots()
  .flatMap(walk)
  .map((path) => ({ path, lines: countLines(readFileSync(path, 'utf8')) }))
  .filter((file) => file.lines > MAX_LINES)
  .sort((left, right) => right.lines - left.lines);

if (offenders.length > 0) {
  console.error(`Files over ${MAX_LINES} lines:`);
  for (const file of offenders) {
    console.error(`  ${String(file.lines).padStart(5)}  ${relative(process.cwd(), file.path)}`);
  }
  console.error('Split them by responsibility rather than raising the cap.');
  process.exit(1);
}

console.log(`All source files are within ${MAX_LINES} lines.`);
