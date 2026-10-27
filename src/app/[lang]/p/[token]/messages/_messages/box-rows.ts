/**
 * Rows for a read-only message box. A fixed `rows` from the line count alone cut the last lines
 * on a phone, where each long line wraps. The width of the box is not known on the server, so a
 * narrow phone width is assumed: a wide screen gets a little spare room, never a cut-off message.
 */
const CHARS_PER_ROW = 32;
const MIN_ROWS = 3;
const MAX_ROWS = 40;

export function boxRows(text: string): number {
  const rows = text
    .split('\n')
    .reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).length / CHARS_PER_ROW)),
      0,
    );
  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, rows + 1));
}
