import 'server-only';

/**
 * What the ladder does after a failed call. Classified on `.status`, never `instanceof`: the
 * interactions error classes are not exported by the SDK (probe, 26 Oct).
 */
export type FailureKind = 'rate-limit' | 'auth' | 'retired' | 'overload' | 'our-bug' | 'transient';

const TIMEOUT_NAMES: ReadonlySet<string> = new Set([
  'TimeoutError',
  'AbortError',
  'APIConnectionTimeoutError',
  'ConnectTimeoutError',
  'HeadersTimeoutError',
  'BodyTimeoutError',
]);

const TIMEOUT_CODES: ReadonlySet<string> = new Set([
  'ETIMEDOUT',
  'ABORT_ERR',
  'UND_ERR_ABORTED',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

const TIMEOUT_MESSAGE = /timed out|timeout|abort/i;

// undici wraps the real reason in `cause` ("fetch failed"), so the chain is walked, with a cap
// in case a cause points back at itself.
const MAX_CAUSE_DEPTH = 5;

function field(error: unknown, name: string): unknown {
  return typeof error === 'object' && error !== null ? Reflect.get(error, name) : undefined;
}

function textField(error: unknown, name: string): string {
  const value = field(error, name);
  return typeof value === 'string' ? value : '';
}

function statusOf(error: unknown): number | undefined {
  for (const name of ['status', 'statusCode']) {
    const value = field(error, name);
    if (typeof value === 'number' && Number.isInteger(value)) return value;
  }
  return undefined;
}

/** Matches the SDK, undici and AbortSignal spellings of a timeout or an abort. */
export function isTimeout(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH && current !== undefined; depth += 1) {
    if (TIMEOUT_NAMES.has(textField(current, 'name'))) return true;
    if (TIMEOUT_CODES.has(textField(current, 'code'))) return true;
    if (TIMEOUT_MESSAGE.test(textField(current, 'message'))) return true;
    current = field(current, 'cause');
  }
  return false;
}

export function classifyFailure(error: unknown): FailureKind {
  const status = statusOf(error);
  if (status === undefined) return isTimeout(error) ? 'overload' : 'transient';
  if (status === 429) return 'rate-limit';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'retired';
  if (status === 408 || status >= 500) return 'overload';
  // A malformed request reproduces on every model and key, so retrying only spends quota.
  if (status === 400 || status === 422) return 'our-bug';
  return 'transient';
}

/** How a call ended, for the per-call log line; the ladder still acts on `classifyFailure`. */
export type CallOutcome = 'timeout' | 'overload' | 'rate-limit' | 'auth' | 'retired' | 'error';

// A client-side timeout and a 5xx both cool the model, but they point at different causes (our
// cap too tight against a slow answer, or the API under load), so the log keeps them apart.
export function callOutcome(error: unknown): CallOutcome {
  const status = statusOf(error);
  if (status === 408 || (status === undefined && isTimeout(error))) return 'timeout';
  const failure = classifyFailure(error);
  return failure === 'our-bug' || failure === 'transient' ? 'error' : failure;
}

/** Thrown for a failure that is ours to fix. The message names the kind only, never reply text. */
export class GatewayBugError extends Error {
  readonly kind: 'bad-request' | 'schema-violation';

  constructor(kind: 'bad-request' | 'schema-violation', detail: string) {
    super(`Model gateway ${kind}: ${detail}`);
    this.name = 'GatewayBugError';
    this.kind = kind;
  }
}
