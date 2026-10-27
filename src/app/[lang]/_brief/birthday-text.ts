import { addDays, partsOf, type IsoDate } from '@/core/calendar/day-number';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** How far ahead the sample birthday falls: close enough that the timeline is visibly tight. */
export const BIRTHDAY_LEAD_DAYS = 7;

/**
 * A short Hinglish birthday brief dated a week after `today`. Code writes the date, so it is
 * always in the future and the model only reads it back. The text changes daily and so can
 * never match a committed recording: it is read live, and the form twin is its fallback.
 * Null only for a `today` at the end of the supported calendar.
 */
export function birthdayBriefText(today: IsoDate): string | null {
  const day = addDays(today, BIRTHDAY_LEAD_DAYS);
  if (!day.ok) return null;
  const parts = partsOf(day.value);
  const month = MONTHS[parts.month - 1];
  if (month === undefined) return null;
  // The committed birthday fixture's wording, with only the date moved.
  return `Papa ka 60th birthday, 2 lakh, 80 log, ${String(parts.day)} ${month}`;
}
