import 'server-only';

/** Decoded form fields: a name sent once is a string, a repeated name (checkboxes) a list. */
export type FormFields = Readonly<Record<string, string | readonly string[]>>;

// Every form in the app has under twenty fields plus a few lever checkboxes; a body with more
// pairs than this is not from our pages, and bounding it bounds the work below.
export const MAX_FORM_PAIRS = 64;

function decodeComponent(raw: string): string | null {
  try {
    return decodeURIComponent(raw.replaceAll('+', ' '));
  } catch {
    // A stray "%", a bad escape or an escape that is not UTF-8 (%FF, a lone surrogate).
    return null;
  }
}

/**
 * Strict application/x-www-form-urlencoded parsing. URLSearchParams is not used because it
 * silently turns a bad escape into U+FFFD, which would let a malformed body through as text
 * the user never typed; here it is refused (null), and the route answers 400.
 */
export function parseUrlencoded(text: string): FormFields | null {
  const collected = new Map<string, string[]>();
  let pairs = 0;
  for (const piece of text.split('&')) {
    // Empty pieces ("a=1&&b=2", a trailing "&") carry nothing, as in the URL standard.
    if (piece === '') continue;
    pairs += 1;
    if (pairs > MAX_FORM_PAIRS) return null;
    const equals = piece.indexOf('=');
    const name = decodeComponent(equals < 0 ? piece : piece.slice(0, equals));
    const value = decodeComponent(equals < 0 ? '' : piece.slice(equals + 1));
    if (name === null || value === null || name === '') return null;
    const values = collected.get(name);
    if (values === undefined) collected.set(name, [value]);
    else values.push(value);
  }
  // Object.fromEntries defines own properties, so a field named "__proto__" stays an ordinary
  // (and, to a strict form schema, unknown) key instead of touching the prototype.
  return Object.fromEntries(
    [...collected].map(([name, values]) => [
      name,
      values.length === 1 ? (values[0] ?? '') : values,
    ]),
  );
}
