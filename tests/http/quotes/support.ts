// Shared pieces for the quote HTTP tests: plans holding some quotes, the committed sample
// quotes and their recordings, a fake gateway that answers the quote prompt, and a capture of
// every log line the steps write, from the injected logger and from the process logger.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { vi } from 'vitest';

import type { ReadDeps } from '@/app/[lang]/read/[kind]/read-step';
import type { Op } from '@/schemas/plan/op';
import type { QuoteRecord } from '@/schemas/plan/quote-record';
import type { PendingReading } from '@/schemas/plan/state-token';
import type { ExampleBook } from '@/server/pipeline/example-readings';

import { fakeLlmGateway, type FakeLlmGateway, type FakeReply } from '../../fakes/llm-gateway';
import { AI_READ, BRIEF_OP, CATERER_A, CATERER_B } from '../../fixtures/plan-readings';
import { keepingLogger } from '../../unit/server/http/step-support';
import { deps, NO_EXAMPLES, seal } from '../support';

export { CATERER_A, CATERER_B, BRIEF_OP };

function repoText(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function recordedReply(fixture: string): unknown {
  const recording: unknown = JSON.parse(repoText(`golden/llm/${fixture}.quote.json`));
  return typeof recording === 'object' && recording !== null && 'reply' in recording
    ? recording.reply
    : null;
}

export const CATERER_A_TEXT = repoText('fixtures/quote-caterer-a.txt');
export const CATERER_A_READING = recordedReply('quote-caterer-a');
export const CATERER_B_TEXT = repoText('fixtures/quote-caterer-b.txt');
export const CATERER_B_READING = recordedReply('quote-caterer-b');
export const INJECTION_TEXT = repoText('fixtures/quote-injection.txt');
export const INJECTION_READING = recordedReply('quote-injection');

/** Words of the sample quote that must never appear in a Location or a log line. */
export const PASTED_WORDS = ['Namaste', 'shaadi', '1300', 'plate', 'chaat', 'GST', 'alag', '15k'];

/** A copy of a fixture without one field, as a post that leaves the field out. */
export function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const entries = Object.entries(value).filter(([name]) => name !== key);
  return Object.fromEntries(entries) as Omit<T, K>;
}

/** The token of any 303 to a plan page (the plan, its check or its quotes page). */
export function tokenIn(response: Response): string {
  const match = /^\/(?:en|hi)\/p\/([A-Za-z0-9_-]+)(?:\/[a-z]+)?(?:[?#].*)?$/.exec(
    response.headers.get('location') ?? '',
  );
  if (match?.[1] === undefined) throw new Error('not a plan location');
  return match[1];
}

/** A sealed plan: the sample brief, then these quotes as quoteAdded ops. */
export function planToken(quotes: readonly QuoteRecord[] = [], pending?: PendingReading): string {
  const ops: Op[] = [
    BRIEF_OP,
    ...quotes.map((quote): Op => ({ kind: 'quoteAdded', quote, readBy: AI_READ })),
  ];
  return seal(pending === undefined ? { schema: 1, ops } : { schema: 1, ops, pending });
}

/** Six catering quotes, A to F: a plan that can hold no more. */
export const SIX_QUOTES: readonly QuoteRecord[] = (['A', 'B', 'C', 'D', 'E', 'F'] as const).map(
  (id, index) => ({ ...CATERER_A, id, rateInr: 1_000 + index * 100 }),
);

/** Step deps for the read route, with a fake gateway answering the quote prompt. */
export function quoteDeps(
  reply: FakeReply,
  examples: ExampleBook = NO_EXAMPLES,
): { readonly gateway: FakeLlmGateway; readonly deps: ReadDeps } {
  const gateway = fakeLlmGateway(new Map([['quote', reply]]));
  return { gateway, deps: { ...deps({ logger: keepingLogger() }), gateway, examples } };
}

/**
 * Runs `work` while keeping every line written to stdout (the process logger's sink), so a
 * test can assert that nothing the person pasted was logged by any module.
 */
export async function stdoutDuring(work: () => Promise<unknown>): Promise<string> {
  const lines: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    lines.push(typeof chunk === 'string' ? chunk : String(chunk));
    return true;
  });
  try {
    await work();
  } finally {
    spy.mockRestore();
  }
  return lines.join('');
}

/** The check page's quote fields exactly as it renders them for the Caterer A reading. */
export const CATERER_A_CHECK = {
  intent: 'confirm',
  category: 'catering',
  basis: 'perPlate',
  rateInr: '1300',
  minimumGuests: '200',
  guestsCovered: '',
  tax: 'extraRateUnstated',
  taxRatePercent: '',
  liveCounterInr: '15000',
  inclusion: ['2 sweet incl', '', '', ''],
  advancePercent: '30',
};

/** Caterer B typed into the quote form twin. */
export const CATERER_B_FORM = {
  category: 'catering',
  basis: 'lumpSum',
  rateInr: '300000',
  minimumGuests: '',
  guestsCovered: '250',
  tax: 'included',
  taxRatePercent: '',
  liveCounterInr: '15000',
  inclusion: ['', '', '', ''],
  advancePercent: '',
};
