import { z } from 'zod';

// Call 4, the one generation (D07). Lines rather than one string so each WhatsApp line can be
// checked and shown on its own; every number in them is checked against the plan's facts.
export const FamilyUpdateDraft = z.object({
  lines: z
    .array(
      z.object({
        text: z
          .string()
          .max(300)
          .describe('One short line of the message, in the requested language.'),
      }),
    )
    .max(6),
});
export type FamilyUpdateDraft = z.infer<typeof FamilyUpdateDraft>;
