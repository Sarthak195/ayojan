import { parseIsoDate } from '@/core/calendar/day-number';
import { dateText } from '@/core/messages/render-values';
import { formatRupees, groupIndian } from '@/core/rupees/format';
import type { Lang } from '@/i18n/lang';

/** "26 Feb 2027" in the page's language; text that is not a date is shown as it came. */
export function dateWords(text: string, lang: Lang): string {
  const parsed = parseIsoDate(text);
  return parsed.ok ? dateText(parsed.value, lang) : text;
}

/** A count in Indian grouping ("1,20,000"); amounts use formatRupees instead. */
export function countWords(value: number): string {
  return groupIndian(value);
}

/** A bound for a question's reason text: rupees for the budget, a plain count otherwise. */
export function boundWords(field: string, value: number): string {
  return field === 'budget' ? formatRupees(value) : groupIndian(value);
}
