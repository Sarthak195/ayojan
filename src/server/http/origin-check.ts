import 'server-only';

/**
 * Whether a POST came from another site. There are no cookies, so a forged post cannot act as
 * anyone, but it can still spend the shared model quota from a visitor's browser.
 *
 * The service answers on several hostnames (the run.app URLs and a tagged URL), and every form
 * posts to a relative URL, so a page's own Origin always names the Host it was served from;
 * no fixed allowlist is needed. `request.url` is not used: behind Cloud Run it reads
 * `http://0.0.0.0:8080` (ADR 0006). A request with neither header (curl, the smoke script)
 * passes, because only a browser can be made to post on someone else's behalf, and browsers
 * send at least one of the two.
 */
export function isCrossSite(headers: Headers): boolean {
  if (headers.get('sec-fetch-site')?.trim().toLowerCase() === 'cross-site') return true;
  const origin = headers.get('origin');
  if (origin === null) return false;
  const host = originHost(origin);
  if (host === undefined) return true;
  const forwarded = headers.get('x-forwarded-host')?.split(',')[0];
  const allowed = [headers.get('host'), forwarded]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value !== '');
  return !allowed.includes(host);
}

// "null" (a sandboxed frame or a data: page) and any unparseable value have no host to match.
function originHost(origin: string): string | undefined {
  try {
    const host = new URL(origin).host.toLowerCase();
    return host === '' ? undefined : host;
  } catch {
    return undefined;
  }
}
