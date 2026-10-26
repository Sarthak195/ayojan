#!/usr/bin/env node
// Scans every tracked text file for stale API usage, the markers that read as unfinished
// work, and anything shaped like a credential. A leaked key is the one hit that can cost
// real money, so the secret rules apply to every file type, docs and fixtures included.
//
// The patterns are assembled from fragments so that this file does not match itself.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const KEY_CHARS = '[A-Za-z0-9_-]';

const RULES = [
  {
    pattern: new RegExp('\\bgenerate' + 'Content\\s*\\('),
    why: 'The Interactions API replaced the legacy Gemini call; use client.interactions.create.',
  },
  {
    pattern: new RegExp('@ts-' + '(?:ignore|expect-error|nocheck)'),
    why: 'Suppressing the type checker hides a problem instead of fixing it.',
  },
  {
    pattern: new RegExp('eslint-' + 'disable'),
    why: 'Suppressing the linter hides a problem instead of fixing it.',
  },
  {
    pattern: new RegExp('\\b(?:TO' + 'DO|FIX' + 'ME)\\b'),
    why: 'Unresolved markers read as abandoned work: finish it or remove it.',
  },
  {
    pattern: new RegExp('dangerously' + 'SetInnerHTML'),
    why: 'Raw HTML injection bypasses React escaping.',
  },
  {
    pattern: new RegExp(String.fromCharCode(0x2014)),
    why: 'Project style: use a comma, colon or parentheses instead of an em dash.',
  },
  {
    pattern: new RegExp('AI' + `za${KEY_CHARS}{35}`),
    why: 'Looks like a Google API key (AIza format).',
    secret: true,
  },
  {
    pattern: new RegExp('\\bAQ' + `\\.${KEY_CHARS}{20,}`),
    why: 'Looks like a Google API key (AQ. format).',
    secret: true,
  },
  {
    pattern: new RegExp('\\bs' + `k-${KEY_CHARS}{20,}`),
    why: 'Looks like an OpenAI-style secret key.',
    secret: true,
  },
  {
    pattern: new RegExp('\\bs' + `k-or-${KEY_CHARS}{10,}`),
    why: 'Looks like an OpenRouter key.',
    secret: true,
  },
  {
    pattern: new RegExp('\\bgs' + `k_${KEY_CHARS}{20,}`),
    why: 'Looks like a Groq key.',
    secret: true,
  },
  {
    pattern: new RegExp('-----BEGIN ' + '[A-Z ]*PRIVATE KEY-----'),
    why: 'A private key must never be committed.',
    secret: true,
  },
];

// A real key is random, so it never contains these words; tests and docs that need a
// key-shaped value can say so. Applies to secrets only, so the list cannot hide a marker.
const PLACEHOLDER = /example|fake|placeholder/i;

const SKIPPED_FILES = new Set(['package-lock.json']);

function listFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return output.split('\0').filter((path) => path !== '' && !SKIPPED_FILES.has(path));
}

function readText(path) {
  try {
    const buffer = readFileSync(path);
    // A NUL byte in the first block marks a binary file, which has no lines to scan.
    return buffer.subarray(0, 8000).includes(0) ? null : buffer.toString('utf8');
  } catch {
    // Tracked but deleted in the working tree: nothing to scan.
    return null;
  }
}

const hits = [];
for (const path of listFiles()) {
  const text = readText(path);
  if (text === null) continue;
  for (const [index, line] of text.split('\n').entries()) {
    for (const rule of RULES) {
      if (!rule.pattern.test(line)) continue;
      if (rule.secret === true && PLACEHOLDER.test(line)) continue;
      hits.push(`${path}:${String(index + 1)}  ${rule.why}`);
    }
  }
}

if (hits.length > 0) {
  console.error(`Forbidden patterns found (${String(hits.length)}):`);
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log('No forbidden patterns or leaked keys found.');
