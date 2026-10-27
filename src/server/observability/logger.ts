import 'server-only';

// The only log sink in src (no-console is a lint error). Cloud Run turns each JSON line on
// stdout into a structured entry, reading `severity` and `message`. Privacy is enforced here
// at runtime, not only by the types below: a cast or a careless caller can hand over any
// value, so every field must be on the allowlist AND pass its shape check, or it is dropped.
// Nothing shaped like free text can pass (no spaces, no capitals in ids, no long strings),
// so a brief, a quote, a token or a raw address never reaches a log line (NFR-SEC-13).

export type LogSeverity = 'INFO' | 'WARNING' | 'ERROR';

type Rule = (value: unknown) => string | number | boolean | undefined;

const MAX_COUNT = 1_000_000_000;

const integerIn =
  (min: number, max: number): Rule =>
  (value) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
      ? value
      : undefined;

const matching =
  (pattern: RegExp): Rule =>
  (value) =>
    typeof value === 'string' && pattern.test(value) ? value : undefined;

// A lowercase slug: event names, op kinds, reasons, prompt and data ids.
const SLUG = /^[a-z][a-z0-9-]{0,47}$/;
const slug = matching(SLUG);
const count = integerIn(0, MAX_COUNT);
const modelId = matching(/^gemini-[a-z0-9.-]{1,40}$/);

const flag: Rule = (value) => (typeof value === 'boolean' ? value : undefined);

const duration: Rule = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_COUNT
    ? Math.round(value)
    : undefined;

/** What a caller may log: counts, ids, durations, model ids and status codes. */
export interface LogFields {
  /** The route template, such as `/[lang]/read/[kind]`; never the path, which holds the token. */
  readonly route?: string;
  readonly status?: number;
  readonly durationMs?: number;
  readonly opKind?: string;
  readonly readingSource?: string;
  readonly promptId?: string;
  readonly reason?: string;
  /** The model that answered, as the API reported it. */
  readonly answeredBy?: string;
  /** The model a call asked for, which may differ from the one that answered. */
  readonly model?: string;
  /** How one model call ended: answer, timeout, overload, rate-limit, auth, retired or error. */
  readonly outcome?: string;
  readonly keyIndex?: number;
  readonly attempt?: number;
  readonly cacheHit?: boolean;
  readonly verified?: number;
  readonly claimed?: number;
  readonly tokenLength?: number;
  readonly bytes?: number;
  readonly count?: number;
  readonly retryAfterSeconds?: number;
  /** The keyed hash from ratelimit/client-key.ts, never an address. */
  readonly client?: string;
  /** An Error subclass name only; messages can quote user input, so they are never logged. */
  readonly errorName?: string;
}

type FieldName = keyof LogFields;

const FIELD_RULES: Readonly<Record<FieldName, Rule>> = {
  route: matching(/^\/[a-z0-9[\]/-]{0,63}$/),
  status: integerIn(100, 599),
  durationMs: duration,
  opKind: matching(/^[a-z][A-Za-z]{0,31}$/),
  readingSource: slug,
  promptId: slug,
  reason: slug,
  answeredBy: modelId,
  model: modelId,
  outcome: slug,
  keyIndex: integerIn(0, 63),
  attempt: integerIn(0, 63),
  cacheHit: flag,
  verified: count,
  claimed: count,
  tokenLength: count,
  bytes: count,
  count,
  retryAfterSeconds: count,
  client: matching(/^[0-9a-f]{16,64}$/),
  errorName: matching(/^[A-Z][A-Za-z]{0,47}$/),
};

const INVALID_EVENT = 'invalid-event';

function isFieldName(name: string): name is FieldName {
  return Object.hasOwn(FIELD_RULES, name);
}

/** One JSON line holding only allowlisted, well-shaped fields, plus how many were dropped. */
export function formatLogLine(
  severity: LogSeverity,
  event: string,
  fields: LogFields = {},
): string {
  const safeEvent = slug(event) ?? INVALID_EVENT;
  const entry: Record<string, string | number | boolean> = {
    severity,
    message: safeEvent,
    event: safeEvent,
  };
  let dropped = 0;
  // Read as unknown entries: any Record<string, unknown> type-checks as the all-optional
  // LogFields, so the static type alone keeps nothing out.
  const supplied: Readonly<Record<string, unknown>> = { ...fields };
  for (const [name, value] of Object.entries(supplied)) {
    if (value === undefined) continue;
    const accepted = isFieldName(name) ? FIELD_RULES[name](value) : undefined;
    if (accepted === undefined) dropped += 1;
    else entry[name] = accepted;
  }
  // A dropped field means a caller is passing something it should not; the count shows the
  // bug without repeating the value.
  if (dropped > 0) entry.dropped = dropped;
  return `${JSON.stringify(entry)}\n`;
}

export type LogSink = (line: string) => void;

// Looked up at call time, so nothing touches stdout when the module loads.
const stdoutSink: LogSink = (line) => {
  process.stdout.write(line);
};

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export function createLogger(sink: LogSink = stdoutSink): Logger {
  const emit = (severity: LogSeverity, event: string, fields?: LogFields): void => {
    try {
      sink(formatLogLine(severity, event, fields));
    } catch {
      // A failed log write (a closed pipe) must never fail the request it describes.
    }
  };
  return {
    info: (event, fields) => {
      emit('INFO', event, fields);
    },
    warn: (event, fields) => {
      emit('WARNING', event, fields);
    },
    error: (event, fields) => {
      emit('ERROR', event, fields);
    },
  };
}

/** The process logger. It holds no state, so one per module bundle is harmless. */
export const log: Logger = createLogger();
