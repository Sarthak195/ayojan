import 'server-only';

// One version per reply schema. Each is part of the reading-cache key and is written into every
// recording, so changing a schema means bumping its version here: old cache entries stop
// matching and the replay test refuses recordings made for the old shape.
export const SCHEMA_VERSIONS = {
  brief: '1',
  quote: '1',
  change: '1',
  familyUpdate: '1',
} as const;

export type ReadingKind = 'brief' | 'quote' | 'change';
