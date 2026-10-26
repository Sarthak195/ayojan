// Pinned plan views for the golden tests. A view is compared, whole and with no field left out,
// against the JSON committed under tests/golden/plans. The files were first written from a run
// (AYOJAN_PIN_GOLDEN=1) after the hand check recorded in each test's header, then frozen: a
// changed number now fails the test until someone looks at it and re-pins on purpose.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from 'vitest';

const PLANS = join(process.cwd(), 'tests', 'golden', 'plans');

/** Plain JSON, so a Map, a Set or an undefined field in a view fails here, not in a page. */
export function asJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

export function expectPinned(name: string, value: unknown): void {
  const path = join(PLANS, `${name}.json`);
  expect(asJson(value)).toStrictEqual(value);
  if (process.env.AYOJAN_PIN_GOLDEN === '1') {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    return;
  }
  expect(existsSync(path), `missing pinned view ${name}.json`).toBe(true);
  expect(asJson(value)).toStrictEqual(JSON.parse(readFileSync(path, 'utf8')) as unknown);
}
