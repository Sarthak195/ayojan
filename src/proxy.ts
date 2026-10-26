import { NextResponse, type NextRequest } from 'next/server';

import { LANG_HEADER, langOfPath, PATH_HEADER } from '@/i18n/path';
import { buildContentSecurityPolicy } from '@/security/content-security-policy';
import { linkGateRefusal } from '@/server/http/link-gate';

export function proxy(request: NextRequest): Response {
  const nonce = btoa(crypto.randomUUID());
  const policy = buildContentSecurityPolicy({
    nonce,
    isDevelopment: process.env.NODE_ENV === 'development',
  });

  const { pathname } = request.nextUrl;
  // A bad language or a damaged plan link gets its 404 here, as plain HTML, because a page's
  // notFound() would send a shell that needs JavaScript to show anything (see link-gate.ts).
  const refusal = linkGateRefusal(request.method, pathname);
  if (refusal !== null) {
    refusal.headers.set('content-security-policy', policy);
    return refusal;
  }

  // Next reads the nonce from the request's policy and stamps it on its own scripts, so the
  // header sent out and the attributes in the HTML come from one value.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', policy);
  // Set on every request, never only when present, so a client cannot supply its own value:
  // the root layout writes <html lang> and the language switch from these two.
  headers.set(LANG_HEADER, langOfPath(pathname));
  headers.set(PATH_HEADER, pathname);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', policy);
  return response;
}

// Static build output and icons are served as files, where a document policy governs nothing.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icon\\.|apple-icon\\.).*)'],
};
