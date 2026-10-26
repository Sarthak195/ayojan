# ADR 0009: Rendering choices: dynamic everywhere, a per-request nonce, path locales and hand-written rupees

Status: Accepted, 26 Oct 2026

## Context

Four choices about how pages are produced fit together, and each one shapes the others.

- The pages carry a family's budget, so they should run only scripts the server itself put there.
  That means a Content Security Policy that allows scripts by nonce, not by `'unsafe-inline'`.
- Every page is a function of a private link. There is nothing shared to cache or prerender.
- The interface is in English and Hindi, and a link is shared over chat, so the language has to
  survive a pasted URL and work without JavaScript.
- Rupee amounts appear in golden files and on phones, and they must print the same everywhere.

Next.js 16 differs from earlier versions here (the proxy replaced middleware, and nonces need
dynamic rendering), so the decision follows Next's own bundled guide on Content Security Policy.

## Decision

- **Every route is dynamic.** The root layout awaits `connection()`
  ([`layout.tsx`](../../src/app/layout.tsx)), the not-found pages do the same, and each of the nine
  route handlers (the seven POST steps, `/api/health` and `/`) exports
  `dynamic = 'force-dynamic'`. Next stamps a nonce on its scripts only while rendering a request, so
  one prerendered page would ship scripts the policy blocks. Setting it once in the root layout
  means a page added later cannot forget.
- **A fresh nonce on every response.** [`src/proxy.ts`](../../src/proxy.ts) (the Next 16 name for
  middleware) makes a nonce per request and sends
  [`buildContentSecurityPolicy`](../../src/security/content-security-policy.ts): a `script-src` of `'self'`, a nonce and `'strict-dynamic'`, with no `'unsafe-inline'` or `'unsafe-eval'` in production, and
  `default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'self'`,
  `object-src 'none'` and `upgrade-insecure-requests`. The proxy also answers the unknown-language
  and damaged-link cases itself as plain HTML ([`link-gate.ts`](../../src/server/http/link-gate.ts)),
  because a `notFound()` outside a Suspense boundary sends an empty shell that needs JavaScript to
  show anything.
- **Fixed headers in config.** [`next.config.ts`](../../next.config.ts) adds `nosniff`, a same-origin
  referrer policy, `X-Frame-Options: DENY` and a Permissions-Policy that turns off the browser
  features the app does not use, and removes `X-Powered-By`. HSTS, COOP and CORP are left out on
  purpose: the default Cloud Run host ends in `.app`, which browsers already treat as HTTPS-only,
  and there is no cross-origin resource to isolate.
- **No streaming.** There is no `Suspense` boundary or `loading.tsx` in `src`. A page is computed
  from the link in one request (decrypt, fold, build the view, with the planning data already in memory), so there is nothing
  slow to stream. The one slow step is the model call, which runs in a POST, is requested with
  `stream: false`, and is verified as a whole before anything is shown.
- **Languages in the path.** `/en` and `/hi` are the first segment. The proxy copies the language
  and path to request headers, always overwriting any value the client sent, because the root
  layout sits above `[lang]` and cannot see params. The layout writes `<html lang>` from it, and the
  language switch is a plain link to the same page with the same token
  ([`path.ts`](../../src/i18n/path.ts)). A cookie or an `Accept-Language` header would not survive a
  shared link.
- **Rupees by hand.** [`format.ts`](../../src/core/rupees/format.ts) groups digits as 3 then pairs
  ("Rs 7,50,000") and writes lakh and crore words ("7.5 lakh", "7.5 लाख"), in both languages with
  Western digits. `Intl.NumberFormat('en-IN')` depends on the ICU data in each Node build and
  browser, so the same amount could print differently in a golden file and on a phone. The rupee
  sign is accepted as input only, because it may not render on old phone fonts.

## Consequences

### Good

- Injected markup cannot run a script, because only nonced scripts execute, and a page cannot be
  framed or post a form to another site.
- A new route is dynamic without anyone remembering to say so.
- Output is identical on every runtime, so golden tests compare it exactly.
- The language is part of the address, so shared links and no-JavaScript visits work.

### Costly

- Every request is rendered on the server and none is served from a cache. Because each page is
  private to its link, a shared cache would have had nothing to hold.
- `style-src` allows `'unsafe-inline'`, because inline style attributes cannot carry a nonce. The
  policy still blocks loading anything from other origins.
- The repository owns the rupee grouping, rounding and word rules, and their edge cases.
- Hindi amounts use Western digits, not Devanagari numerals.
- The dynamic setting and the proxy are Next.js 16 conventions and must be re-read when the
  framework is upgraded.

### Verified

- [`tests/unit/security/content-security-policy.test.ts`](../../tests/unit/security/content-security-policy.test.ts)
  and [`tests/unit/app/security-headers.test.ts`](../../tests/unit/app/security-headers.test.ts)
  cover the policy, the fresh nonce, and the fixed headers on the proxy's own 404s.
- [`tests/unit/app/proxy.test.ts`](../../tests/unit/app/proxy.test.ts) and
  [`link-gate.test.ts`](../../tests/unit/server/http/link-gate.test.ts) cover the language headers
  and the proxy's answers.
- [`tests/unit/i18n/path.test.ts`](../../tests/unit/i18n/path.test.ts) covers language detection and
  the switch link, and [`format.test.ts`](../../tests/unit/core/rupees/format.test.ts) covers
  grouping, words and rounding.
- Manual check, 26 Oct 2026: on the deployed service, the revision page loaded under the live policy,
  its running-total island hydrated and responded to a click, and the browser console showed no
  policy violation and no hydration error. There is no automated
  browser test for this.

## Rejected alternative

**Prerender pages and allow inline scripts with `'unsafe-inline'`.** Pages could be served from a
cache. The cost is that any script an attacker managed to inject would run, which defeats the
policy on a page that shows a family's budget, and the cache would have nothing to hold because
every page depends on a private link. Locale cookies and `Intl` formatting were rejected for
smaller reasons: a cookie does not travel in a shared link, and `Intl` output differs between
runtimes.
