// A plain JSON object: arrays are excluded because every caller walks keys, not indexes.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
