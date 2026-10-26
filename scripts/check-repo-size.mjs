#!/usr/bin/env node
// The contest caps the repository at 10 MB including history, so this fails at 9 MB. It
// measures the object database rather than the working tree: a binary committed and later
// deleted still counts, and removing it needs a history rewrite.

import { execFileSync } from 'node:child_process';

const LIMIT_BYTES = 9 * 1024 * 1024;
const LARGEST_TO_REPORT = 10;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

function totalBytes() {
  const counts = git(['count-objects', '-v']);
  const kilobytes = (field) =>
    Number(new RegExp(`^${field}: (\\d+)$`, 'm').exec(counts)?.[1] ?? '0');
  return (kilobytes('size-pack') + kilobytes('size')) * 1024;
}

function largestBlobs() {
  const pathByOid = new Map(
    git(['rev-list', '--objects', '--all'])
      .split('\n')
      .filter((line) => line.includes(' '))
      .map((line) => [line.slice(0, line.indexOf(' ')), line.slice(line.indexOf(' ') + 1)]),
  );
  return git([
    'cat-file',
    '--batch-check=%(objecttype) %(objectname) %(objectsize)',
    '--batch-all-objects',
  ])
    .split('\n')
    .map((line) => line.split(' '))
    .filter(([type]) => type === 'blob')
    .map(([, oid = '', size = '0']) => ({ path: pathByOid.get(oid) ?? oid, bytes: Number(size) }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, LARGEST_TO_REPORT);
}

const total = totalBytes();
const blobs = largestBlobs();

const report = total > LIMIT_BYTES ? console.error : console.log;
report(`Repository history is ${megabytes(total)} (guard: ${megabytes(LIMIT_BYTES)}).`);
report('Largest blobs in history:');
for (const blob of blobs) report(`  ${megabytes(blob.bytes).padStart(9)}  ${blob.path}`);

if (total > LIMIT_BYTES) process.exit(1);
