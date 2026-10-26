import { deflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { seal as sealBytes } from '@/server/state/seal';
import { loadLangPage, loadPlanPage, OPEN_FAILURE_STATUS, openPlan } from '@/server/view/plan-page';

import { BRIEF_STATE, OTHER_KEY, seal, SEAL_KEY, sources, TODAY } from './step-support';

// A token whose JSON names a schema this build does not know, sealed with the real key.
function futureToken(): string {
  const json = Buffer.from(JSON.stringify({ schema: 2, ops: [] }), 'utf8');
  return sealBytes(deflateRawSync(json), SEAL_KEY).toString('base64url');
}

// A middle character: all six of its bits are payload, unlike the last one's padding bits.
function flip(token: string): string {
  const swapped = token[20] === 'A' ? 'B' : 'A';
  return `${token.slice(0, 20)}${swapped}${token.slice(21)}`;
}

// next/navigation's notFound() throws an error whose digest names the 404 fallback.
async function digestOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'digest' in error) {
      return String(error.digest);
    }
    throw error;
  }
  return 'resolved';
}

describe('openPlan', () => {
  it('opens a sealed brief into one view computed against today', () => {
    const token = seal(BRIEF_STATE);
    const opened = openPlan(token, sources());
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.plan.token).toBe(token);
    expect(opened.plan.today).toBe(TODAY);
    expect(opened.plan.view?.current.version).toBe(1);
    expect(opened.plan.state.ops).toHaveLength(1);
  });

  it('refuses a state with no steps and nothing pending', () => {
    const pendingOnly = { schema: 1 as const, ops: [] };
    const empty = openPlan(seal(pendingOnly), sources());
    expect(empty).toEqual({ ok: false, failure: 'unfoldable', reason: 'empty' });
  });

  const cases: readonly [string, () => string, string, string][] = [
    ['empty token', () => '', 'damaged', 'empty'],
    ['bad charset', () => 'abc$def', 'damaged', 'bad-charset'],
    ['over the cap', () => 'a'.repeat(4001), 'damaged', 'too-long'],
    ['one edited character', () => flip(seal(BRIEF_STATE)), 'damaged', 'tampered'],
    ['another key', () => seal(BRIEF_STATE, OTHER_KEY), 'damaged', 'tampered'],
    ['a newer format', futureToken, 'older-version', 'unknown-version'],
  ];

  it.each(cases)('maps %s to %s', (_name, token, failure, reason) => {
    expect(openPlan(token(), sources())).toEqual({ ok: false, failure, reason });
  });

  it('calls a link whose steps no longer fold unfoldable', () => {
    const [brief] = BRIEF_STATE.ops;
    if (brief === undefined) throw new Error('fixture');
    const twoBriefs = seal({ schema: 1, ops: [brief, brief] });
    const opened = openPlan(twoBriefs, sources());
    expect(opened).toMatchObject({ ok: false, failure: 'unfoldable', reason: 'apply' });
  });

  it('answers 404 on a page and 400 from a step', () => {
    expect(OPEN_FAILURE_STATUS).toEqual({ get: 404, post: 400 });
  });
});

describe('page loaders', () => {
  it('loads the plan and the dictionary for a valid language and token', async () => {
    const page = await loadPlanPage(
      Promise.resolve({ lang: 'hi', token: seal(BRIEF_STATE) }),
      sources(),
    );
    expect(page.lang).toBe('hi');
    expect(page.dict.common.productName).toBe('आयोजन');
    expect(page.view).not.toBeNull();
  });

  it('turns a damaged link into the not-found page (404)', async () => {
    const digest = await digestOf(
      loadPlanPage(Promise.resolve({ lang: 'en', token: 'not-a-real-token' }), sources()),
    );
    expect(digest).toContain('404');
  });

  it('turns an unknown language into the not-found page (404)', async () => {
    expect(await digestOf(loadLangPage(Promise.resolve({ lang: 'fr' })))).toContain('404');
    expect(
      await digestOf(
        loadPlanPage(Promise.resolve({ lang: 'fr', token: seal(BRIEF_STATE) }), sources()),
      ),
    ).toContain('404');
  });
});
