// The check on a model-written family update (D07). The model writes only from the facts, but
// nothing it writes is trusted: every number found in the draft must be one the facts hold,
// and every required question must be touched. A draft that fails is never shown; the
// template is, with the reason. Pure and line by line, so a unit on one line can never
// fuse with a number on the next.

import type { Language } from '@/core/rupees/format';
import { scanAmounts } from '@/core/rupees/parse';
import type { QuestionId } from '@/schemas/generated/ids';

import { factNumbers } from './fact-numbers';
import type { MessageFacts } from './fact-types';
import { mentionsQuestion } from './required-mentions';
import { unscannedNumbers } from './unscanned-numbers';

export type DraftReason =
  'empty' | 'number-not-in-facts' | 'number-unreadable' | 'question-missing';

export interface OffendingNumber {
  /** The characters as the draft wrote them. */
  readonly text: string;
  /** The value read from them, or null when no exact value could be read. */
  readonly value: number | null;
  /** Zero-based index of the draft line. */
  readonly line: number;
  readonly reason: 'not-in-facts' | 'unreadable';
}

export interface DraftCheckInput {
  readonly lines: readonly string[];
  readonly facts: MessageFacts;
  readonly language: Language;
  /** Questions the draft must mention; `reconfirmationQuestionIds(facts)` is the usual list. */
  readonly requiredQuestionIds: readonly QuestionId[];
}

interface DraftCounts {
  /** Numbers found in the draft, for the "n of n" badge. */
  readonly numbersFound: number;
  readonly numbersInFacts: number;
}

export type DraftVerdict =
  | ({ readonly ok: true } & DraftCounts)
  | ({
      readonly ok: false;
      readonly reasons: readonly DraftReason[];
      readonly offendingNumbers: readonly OffendingNumber[];
      readonly missingQuestionIds: readonly QuestionId[];
    } & DraftCounts);

interface LineScan {
  readonly found: number;
  readonly offending: OffendingNumber[];
}

function scanLine(line: string, index: number, allowed: ReadonlySet<number>): LineScan {
  const hits = scanAmounts(line);
  const offending: OffendingNumber[] = [];
  for (const hit of hits) {
    const text = line.slice(hit.start, hit.end);
    if (hit.kind === 'unusable') {
      offending.push({ text, value: null, line: index, reason: 'unreadable' });
    } else if (!allowed.has(hit.inr)) {
      offending.push({ text, value: hit.inr, line: index, reason: 'not-in-facts' });
    }
  }
  const unread = unscannedNumbers(line, hits);
  for (const span of unread) {
    offending.push({
      text: line.slice(span.start, span.end),
      value: null,
      line: index,
      reason: 'unreadable',
    });
  }
  return { found: hits.length + unread.length, offending };
}

function reasonsFor(
  offending: readonly OffendingNumber[],
  missing: readonly QuestionId[],
): DraftReason[] {
  const reasons: DraftReason[] = [];
  if (offending.some((number) => number.reason === 'not-in-facts'))
    reasons.push('number-not-in-facts');
  if (offending.some((number) => number.reason === 'unreadable')) reasons.push('number-unreadable');
  if (missing.length > 0) reasons.push('question-missing');
  return reasons;
}

/** Accepts the draft only when every number is in the facts and every required question is there. */
export function checkDraft(input: DraftCheckInput): DraftVerdict {
  const { lines, facts, language } = input;
  if (lines.every((line) => line.trim() === '')) {
    return {
      ok: false,
      reasons: ['empty'],
      offendingNumbers: [],
      missingQuestionIds: [],
      numbersFound: 0,
      numbersInFacts: 0,
    };
  }
  const allowed = factNumbers(facts);
  const scans = lines.map((line, index) => scanLine(line, index, allowed));
  const offending = scans.flatMap((scan) => scan.offending);
  const numbersFound = scans.reduce((total, scan) => total + scan.found, 0);
  const draftText = lines.join('\n');
  const missing = input.requiredQuestionIds.filter(
    (id) => !mentionsQuestion(draftText, id, language),
  );
  const counts: DraftCounts = { numbersFound, numbersInFacts: numbersFound - offending.length };
  if (offending.length === 0 && missing.length === 0) return { ok: true, ...counts };
  return {
    ok: false,
    reasons: reasonsFor(offending, missing),
    offendingNumbers: offending,
    missingQuestionIds: missing,
    ...counts,
  };
}
