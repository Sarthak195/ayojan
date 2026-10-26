import 'server-only';

import { notFound } from 'next/navigation';

import type { IsoDate } from '@/core/calendar/day-number';
import { viewOfOps, type PlanView } from '@/core/plan/plan-view';
import { dictionaryFor, type Dictionary } from '@/i18n/dictionary';
import { isLang, type Lang } from '@/i18n/lang';
import type { DataDocuments } from '@/schemas/data/data-files';
import type { StateToken } from '@/schemas/plan/state-token';

import { todayInIndia } from '../config/clock';
import { knowledge } from '../knowledge/repository';
import { loadSealKey } from '../state/seal-key';
import { decodeState } from '../state/token-codec';

/**
 * Why a link did not open. `older-version` is a token sealed in a format this build does not
 * know; `unfoldable` is a token that decrypts but whose steps no longer fold against the data.
 * Each becomes the damaged-link words: 404 on a GET page (D6), 400 from a POST (arch 6.3).
 */
export type OpenFailure = 'damaged' | 'older-version' | 'unfoldable';

export const OPEN_FAILURE_STATUS = { get: 404, post: 400 } as const;

export interface OpenedPlan {
  readonly token: string;
  readonly state: StateToken;
  /** Null only while a first brief waits on the check page and nothing is confirmed yet. */
  readonly view: PlanView | null;
  readonly data: DataDocuments;
  readonly today: IsoDate;
}

export type OpenResult =
  | { readonly ok: true; readonly plan: OpenedPlan }
  | { readonly ok: false; readonly failure: OpenFailure; readonly reason: string };

/** Where a plan's inputs come from; injected in tests, the process-wide ones otherwise. */
export interface PlanSources {
  sealKey(): Uint8Array;
  data(): DataDocuments;
  today(): IsoDate;
}

export function defaultPlanSources(): PlanSources {
  return {
    sealKey: () => loadSealKey(),
    data: () => knowledge().all(),
    today: () => todayInIndia(),
  };
}

function refused(failure: OpenFailure, reason: string): OpenResult {
  return { ok: false, failure, reason };
}

/**
 * The token in the URL as a plan: decode (cap, charset, decrypt, inflate, parse, schema), then
 * fold the ops once and build the one view the page renders. A broken seal key or data file
 * throws: that is a server fault (500), not a damaged link.
 */
export function openPlan(token: string, sources: PlanSources = defaultPlanSources()): OpenResult {
  const decoded = decodeState(token, sources.sealKey());
  if (!decoded.ok) {
    return refused(
      decoded.reason === 'unknown-version' ? 'older-version' : 'damaged',
      decoded.reason,
    );
  }
  const { state } = decoded;
  const data = sources.data();
  const today = sources.today();
  if (state.ops.length === 0) {
    // A brief read but not yet confirmed is the only legal state with no ops.
    if (state.pending === undefined) return refused('unfoldable', 'empty');
    return { ok: true, plan: { token, state, view: null, data, today } };
  }
  const view = viewOfOps(state.ops, data, today);
  if (!view.ok) return refused('unfoldable', view.refusal.kind);
  return { ok: true, plan: { token, state, view: view.value, data, today } };
}

export interface LangPage {
  readonly lang: Lang;
  readonly dict: Dictionary;
}

export interface PlanPage extends OpenedPlan, LangPage {}

/** For pages under [lang]: an unknown language is a 404. */
export async function loadLangPage(params: Promise<{ lang: string }>): Promise<LangPage> {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return { lang, dict: dictionaryFor(lang) };
}

/**
 * For pages under [lang]/p/[token]: the opened plan, or the segment's not-found page (404)
 * for a damaged, older or unfoldable link, so a page never renders half a plan.
 */
export async function loadPlanPage(
  params: Promise<{ lang: string; token: string }>,
  sources: PlanSources = defaultPlanSources(),
): Promise<PlanPage> {
  const { lang, token } = await params;
  if (!isLang(lang)) notFound();
  const opened = openPlan(token, sources);
  if (!opened.ok) notFound();
  return { ...opened.plan, lang, dict: dictionaryFor(lang) };
}
