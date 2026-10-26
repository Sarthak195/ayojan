import 'server-only';

import { createHmac, randomBytes } from 'node:crypto';

// Behind Cloud Run, Google's front end appends the address it saw to `x-forwarded-for`, so
// the rightmost entry is the only one a caller cannot choose. Entries to its left are
// whatever the caller sent and are ignored. Honest limits, also stated in SECURITY.md: the
// header still arrives from outside, so a caller with many addresses gets many buckets, and
// run locally without a front end the whole header is caller-supplied. The per-client bound
// is therefore advisory; the per-instance daily budget and `--max-instances` are the real
// blast-radius control.
const FORWARDED_FOR = 'x-forwarded-for';

// Requests without the header (local development, tests) share one bucket rather than
// bypassing the limits.
const NO_ADDRESS = 'no-forwarded-address';

// An IPv6 address with a zone id is well under this; anything longer is not an address, and
// truncating it bounds the work of hashing a hostile header.
const MAX_ENTRY_LENGTH = 100;

const SALT_HOLDER = Symbol.for('ayojan.ratelimit.client-salt');
type SaltHolder = typeof globalThis & { [SALT_HOLDER]?: Buffer };

// A plain SHA-256 of an IPv4 address is reversible by trying all 2^32 of them, so the hash is
// keyed with a secret made once per process. Buckets are per instance anyway, so a key that
// differs between instances loses nothing, and the raw address is never stored or logged.
function processSalt(): Buffer {
  const holder: SaltHolder = globalThis;
  const held = holder[SALT_HOLDER];
  if (held !== undefined) return held;
  const created = randomBytes(32);
  holder[SALT_HOLDER] = created;
  return created;
}

/** The rightmost non-empty `x-forwarded-for` entry, or null when there is none. */
export function rightmostForwardedFor(headers: Headers): string | null {
  const header = headers.get(FORWARDED_FOR);
  if (header === null) return null;
  const entry = header.slice(header.lastIndexOf(',') + 1).trim();
  return entry === '' ? null : entry.slice(0, MAX_ENTRY_LENGTH);
}

/**
 * The rate-limit key for a request: a SHA-256 HMAC (hex) of the rightmost forwarded address.
 * The salt is injectable so tests can pin the output.
 */
export function clientKeyOf(headers: Headers, salt: Buffer = processSalt()): string {
  const address = rightmostForwardedFor(headers) ?? NO_ADDRESS;
  return createHmac('sha256', salt).update(address).digest('hex');
}
