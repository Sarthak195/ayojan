#!/usr/bin/env node
// Bundle-size gate: the gzip size of every client chunk in .next/static/chunks must stay under a
// budget, so a heavy dependency pulled into the browser fails CI instead of slowing a phone on
// a poor connection. Run it after `next build`. zlib's default gzip level is used, which is an
// estimate of the transfer size, not what a particular server sends. The noModule polyfill chunk
// is left out: only browsers too old for the app download it, and the README does not count it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';

export const LIMIT_BYTES = 140 * 1024;

/** Every .js file under `dir`, found recursively (Turbopack nests some chunks). */
function jsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsFiles(path);
    return name.endsWith('.js') ? [path] : [];
  });
}

/** Basenames of the polyfill chunks the build lists, or none if the manifest is unreadable. */
function polyfillNames(buildDir) {
  try {
    const manifest = JSON.parse(readFileSync(join(buildDir, 'build-manifest.json'), 'utf8'));
    return new Set((manifest.polyfillFiles ?? []).map((file) => basename(file)));
  } catch {
    // Without the manifest the polyfill chunk is counted, so say why the total may look high.
    console.warn('build-manifest.json unreadable, counting the polyfill chunk');
    return new Set();
  }
}

export function gzipTotal(dir) {
  const skip = polyfillNames(join(dir, '..', '..'));
  const files = jsFiles(dir).filter((file) => !skip.has(basename(file)));
  const bytes = files.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);
  return { files: files.length, bytes };
}

const dir = process.argv[2] ?? '.next/static/chunks';
let total;
try {
  total = gzipTotal(dir);
} catch {
  console.error(`No build output in ${dir}. Run "npm run build" first.`);
  process.exit(2);
}
const kib = (bytes) => (bytes / 1024).toFixed(1);
console.log(
  `Client JS: ${kib(total.bytes)} KiB gzip over ${total.files} chunks (limit ${kib(LIMIT_BYTES)} KiB).`,
);
process.exit(total.bytes > LIMIT_BYTES ? 1 : 0);
