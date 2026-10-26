import type { ProblemsDictionary } from './areas/problems';

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/**
 * A Retry-After in words, rounded up to the unit a person reads ("3 minutes", "9 hours"), so
 * the page never invites a retry before the limiter would allow it.
 */
export function waitPhrase(seconds: number, words: ProblemsDictionary['wait']): string {
  const whole = Math.max(1, Math.ceil(seconds));
  if (whole < MINUTE) return words.seconds(whole);
  if (whole < HOUR) return words.minutes(Math.ceil(whole / MINUTE));
  return words.hours(Math.ceil(whole / HOUR));
}
