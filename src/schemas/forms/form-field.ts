import { z } from 'zod';

import { IsoDate } from '../plan/brief';

// Field types shared by the HTTP form schemas. A form schema checks structure only, so a
// failure is a 400; values the user really typed but that are out of range (0 guests, a past
// date, Rs 4,999) pass here and become questions on the check page instead (FR-4).

// The sealed state; its charset, cap and seal are checked by the token codec, not here.
export const TokenField = z.string().min(1).max(4_000);

// Free text. The 2,000-code-point cap is a 422 from the route, not a structural failure.
export const TextField = z.string();

// Typed amounts and counts stay text: "8 lakh" is a legal budget, parsed by core.
export const NumberText = z.string().max(40);

// Empty when the field was left blank; whole digits otherwise, so "1.5" is a 400.
export const OptionalInteger = z
  .union([z.literal(''), z.string().regex(/^\d{1,9}$/)])
  .transform((value) => (value === '' ? null : Number(value)));

export const OptionalDate = z
  .union([z.literal(''), IsoDate])
  .transform((value) => (value === '' ? null : value));

/** Empty, or one of the choices: radio groups where "no change" is a legal answer. */
export function optionalChoice<E extends z.ZodType<string>>(
  choice: E,
): z.ZodUnion<[z.ZodLiteral<''>, E]> {
  return z.union([z.literal(''), choice]);
}

/** A repeated field (checkboxes): absent is empty, one value is a list of one. */
export function listOf<T extends z.ZodType>(
  item: T,
  max: number,
): z.ZodPreprocess<z.ZodArray<T>> {
  return z.preprocess(
    (value: unknown) => (value === undefined ? [] : typeof value === 'string' ? [value] : value),
    z.array(item).max(max),
  );
}
