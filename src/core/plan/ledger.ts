// The ledger of steps (FR-37): one row per op, newest first, in both languages. It is read from
// the ops alone, so nothing is ever re-entered and Undo simply removes the top row. A change row
// carries the family's own words (up to three source quotes of at most 80 UTF-8 bytes).

import { parseIsoDate } from '@/core/calendar/day-number';
import type { ReadBy } from '@/schemas/plan/brief';
import type { Op, OpKind } from '@/schemas/plan/op';

import { profileForOccasion } from '../budget/budget-profile';
import { dateText } from '../messages/render-values';
import { quoteLabel } from '../quotes/quote-wording';
import { formatRupees, groupIndian, type Language } from '../rupees/format';
import type { PlanData } from './plan-data';

export interface LedgerRow {
  /** 1 for the brief; the plan version this op produced. */
  readonly version: number;
  readonly kind: OpKind;
  readonly en: string;
  readonly hi: string;
  readonly sources: readonly string[];
  readonly readBy: ReadBy | null;
}

type Words = Readonly<Record<Language, string>>;

function date(text: string, language: Language): string {
  const parsed = parseIsoDate(text);
  return parsed.ok ? dateText(parsed.value, language) : text;
}

function readByText(readBy: ReadBy, language: Language): string {
  const matched = String(readBy.matched);
  const total = String(readBy.total);
  if (readBy.source === 'form') return language === 'en' ? 'entered by form' : 'फ़ॉर्म से भरा';
  return language === 'en'
    ? `read by AI, ${matched} of ${total} values verified`
    : `AI ने पढ़ा, ${total} में से ${matched} मान आपके शब्दों से मिले`;
}

function taskName(data: PlanData, taskId: string): Words {
  const row = data.tasks.tasks.find((task) => task.id === taskId);
  return { en: row?.en ?? taskId, hi: row?.hi ?? taskId };
}

function categoryName(data: PlanData, op: Op | undefined, category: string): Words {
  const occasion = op?.kind === 'briefConfirmed' ? op.brief.occasion : 'wedding';
  const profile = profileForOccasion(data.budgetWeights, occasion);
  const row = profile.ok
    ? profile.value.categories.find((line) => line.category === category)
    : undefined;
  return { en: row?.en ?? category, hi: row?.hi ?? category };
}

function changeWords(
  op: Extract<Op, { kind: 'changeConfirmed' }>,
  data: PlanData,
  brief: Op | undefined,
): Words {
  const parts: { en: string; hi: string }[] = [];
  if (op.guests !== null) {
    const count = groupIndian(op.guests);
    parts.push({ en: `guests ${count}`, hi: `मेहमान ${count}` });
  }
  if (op.budgetInr !== null) {
    const amount = formatRupees(op.budgetInr);
    parts.push({ en: `budget ${amount}`, hi: `बजट ${amount}` });
  }
  if (op.eventDate !== null) {
    parts.push({
      en: `date ${date(op.eventDate, 'en')}`,
      hi: `तारीख़ ${date(op.eventDate, 'hi')}`,
    });
  }
  if (op.reallocate !== null) {
    const amount = formatRupees(op.reallocate.amountInr);
    const name = categoryName(data, brief, op.reallocate.to);
    parts.push({ en: `${amount} moved to ${name.en}`, hi: `${amount} ${name.hi} में डाले` });
  }
  if (op.priorities !== null) parts.push({ en: 'priorities revised', hi: 'प्राथमिकताएँ बदलीं' });
  return {
    en: `Change: ${parts.map((part) => part.en).join(', ')}`,
    hi: `बदलाव: ${parts.map((part) => part.hi).join(', ')}`,
  };
}

function words(op: Op, data: PlanData, brief: Op | undefined): Words {
  switch (op.kind) {
    case 'briefConfirmed': {
      const { budgetInr, guests, eventDate } = op.brief;
      const count = groupIndian(guests);
      const amount = formatRupees(budgetInr);
      return {
        en: `Brief confirmed: ${amount}, ${count} guests, ${date(eventDate, 'en')} (${readByText(op.readBy, 'en')})`,
        hi: `ब्रीफ़ पक्का: ${amount}, ${count} मेहमान, ${date(eventDate, 'hi')} (${readByText(op.readBy, 'hi')})`,
      };
    }
    case 'quoteAdded':
      return {
        en: `Quote added: ${quoteLabel(op.quote, 'en')} (${readByText(op.readBy, 'en')})`,
        hi: `कोटेशन जोड़ा: ${quoteLabel(op.quote, 'hi')} (${readByText(op.readBy, 'hi')})`,
      };
    case 'taskDone': {
      const name = taskName(data, op.taskId);
      const amount = op.amountInr === null ? null : formatRupees(op.amountInr);
      const count = op.capacity === null ? null : groupIndian(op.capacity);
      return {
        en: [
          `${name.en} marked done`,
          amount && `booked at ${amount}`,
          count && `for ${count} guests`,
        ]
          .filter(Boolean)
          .join(', '),
        hi: [
          `${name.hi} पूरा हुआ`,
          amount && `${amount} में बुक`,
          count && `${count} मेहमानों के लिए`,
        ]
          .filter(Boolean)
          .join(', '),
      };
    }
    case 'taskDelayed': {
      const name = taskName(data, op.taskId);
      return {
        en: `${name.en} delayed: not before ${date(op.notBefore, 'en')}`,
        hi: `${name.hi} में देर: ${date(op.notBefore, 'hi')} से पहले नहीं`,
      };
    }
    case 'changeConfirmed':
      return changeWords(op, data, brief);
    case 'leversApplied': {
      const labels = op.leverIds.map((id) => {
        const row = data.levers.levers.find((lever) => lever.id === id);
        const raise =
          id === 'raise-budget' && op.raiseBudgetInr !== null
            ? ` (${formatRupees(op.raiseBudgetInr)})`
            : '';
        return { en: `${row?.en ?? id}${raise}`, hi: `${row?.hi ?? id}${raise}` };
      });
      return {
        en: `Trade-offs chosen: ${labels.map((label) => label.en).join('; ')}`,
        hi: `चुने गए समझौते: ${labels.map((label) => label.hi).join('; ')}`,
      };
    }
  }
}

/** Newest first, so the step Undo would remove is the top row. */
export function ledgerRows(ops: readonly Op[], data: PlanData): readonly LedgerRow[] {
  const brief = ops[0];
  return ops
    .map((op, index) => ({
      version: index + 1,
      kind: op.kind,
      ...words(op, data, brief),
      sources: op.kind === 'changeConfirmed' ? op.sources : [],
      readBy:
        op.kind === 'taskDone' || op.kind === 'taskDelayed' || op.kind === 'leversApplied'
          ? null
          : op.readBy,
    }))
    .reverse();
}
