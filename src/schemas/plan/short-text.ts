import { z } from 'zod';

// Display quotes and change sources live inside the sealed link, whose length is capped, and a
// Devanagari character takes three UTF-8 bytes, so the unit is bytes, not characters. Zod's
// `.max` counts UTF-16 units, hence the refine (D31).
export const SHORT_TEXT_MAX_BYTES = 80;

const encoder = new TextEncoder();

export function utf8ByteLength(text: string): number {
  return encoder.encode(text).length;
}

/** Cuts text to at most 80 UTF-8 bytes without splitting a code point (or a surrogate pair). */
export function toShortText(text: string): string {
  let bytes = 0;
  let cut = '';
  for (const codePoint of text) {
    bytes += utf8ByteLength(codePoint);
    if (bytes > SHORT_TEXT_MAX_BYTES) break;
    cut += codePoint;
  }
  return cut;
}

export const ShortText = z
  .string()
  .refine(
    (text) => utf8ByteLength(text) <= SHORT_TEXT_MAX_BYTES,
    `At most ${String(SHORT_TEXT_MAX_BYTES)} UTF-8 bytes.`,
  );
export type ShortText = z.infer<typeof ShortText>;
