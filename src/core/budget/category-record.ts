// Builds a record with one entry per category without a type assertion: the literal below
// is checked against Record<Category, T>, so adding a category to the vocabulary breaks the
// build here instead of leaving a hole at run time.

import type { Category } from '@/schemas/readings/vocabulary';

/** Null when `pick` has no value for some category, so a partial source never builds a record. */
export function categoryRecord<T>(
  pick: (category: Category) => T | undefined,
): Readonly<Record<Category, T>> | null {
  const venue = pick('venue');
  const catering = pick('catering');
  const decor = pick('decor');
  const photo = pick('photo');
  const music = pick('music');
  const invites = pick('invites');
  const contingency = pick('contingency');
  if (
    venue === undefined ||
    catering === undefined ||
    decor === undefined ||
    photo === undefined ||
    music === undefined ||
    invites === undefined ||
    contingency === undefined
  ) {
    return null;
  }
  return { venue, catering, decor, photo, music, invites, contingency };
}
