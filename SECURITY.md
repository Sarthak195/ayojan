# Security

This file says what Ayojan defends against, where each defence lives in the code, which test
pins it, and what is weaker than it looks. Where a claim was measured, the command or date is
beside it. What data leaves the app, and for how long it lives, is in
[docs/DATA_HANDLING.md](docs/DATA_HANDLING.md).

## The shape of the system, and why it limits the damage

- **There is no database, no account, no session and no cookie.** A plan is a sealed token in
  the URL path. Nothing in `src` calls `cookies()` or sets a cookie, and the redirect builder
  rejects a header-splitting token (`tests/unit/server/http/see-other.test.ts`).
- **The model decides nothing.** Gemini turns free text into a closed JSON shape. Budgets,
  schedules, comparisons and every rupee figure are computed in TypeScript from `data/`. The
  reading schemas in `src/schemas/readings/` have no field for confirmation, availability,
  ranking or recommendation, so a planted instruction has nowhere to land.
- **Every claim carries a verbatim quote, and code checks it.** `src/core/grounding/` looks for
  the quote in the user's own text. A value whose quote is not found is shown as unverified,
  not dropped and not trusted.
- **Nothing is fetched on the user's behalf.** `src` makes no outbound request except the
  Gemini call in `src/server/genai/client.ts`. It never follows a URL found in user text, loads
  no third-party script, font or stylesheet, and has no upload route.

## Threat model

| Threat                                               | Control                                                                                                                                                                                                                         | Where                                                                                                                                            | Test                                                                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt injection in a brief, quote or change message | Closed schemas without decision fields; untrusted text wrapped in a delimiter that pasted text cannot close; guardrail rules in every prompt; quote verification; all arithmetic in code                                        | `src/schemas/readings/`, `src/server/prompts/shared/guardrails.ts`, `src/server/genai/interactions.ts`, `src/core/grounding/`                    | `tests/security/injection.test.ts`, `tests/unit/server/prompts/delimiter.test.ts`, `tests/unit/server/prompts/guardrails.test.ts`, `tests/unit/core/grounding/verification.test.ts` |
| Script injection, XSS                                | Per-request nonce CSP; React escaping only; problem pages escape every interpolation; the raw-HTML injection API is banned by the forbidden-pattern scan, and a search of `src` finds no `innerHTML`, `eval(` or `new Function` | `src/proxy.ts`, `src/security/content-security-policy.ts`, `src/server/http/problem-page.ts`, `scripts/check-forbidden-apis.mjs`                 | `tests/unit/security/content-security-policy.test.ts`, `tests/unit/app/security-headers.test.ts`, `tests/unit/server/http/problem-page.test.ts`                                     |
| Clickjacking, MIME sniffing, referrer leak           | `frame-ancestors 'none'` and `X-Frame-Options: DENY`; `nosniff`; `Referrer-Policy: same-origin`; `Permissions-Policy` refusing the features it names                                                                            | `next.config.ts`, `src/security/content-security-policy.ts`                                                                                      | `tests/unit/app/security-headers.test.ts`                                                                                                                                           |
| Reading or editing a plan's state                    | AES-256-GCM seal with authenticated data; length and charset checked before decoding; bounded inflate; Zod after decrypt                                                                                                        | `src/server/state/seal.ts`, `src/server/state/token-codec.ts`                                                                                    | `tests/unit/server/state/seal.test.ts`, `tests/unit/server/state/token-codec.test.ts`                                                                                               |
| Malformed or oversized request                       | Rate limit, then content type, size, encoding and shape, in that order, before any work                                                                                                                                         | `src/server/http/post-step.ts`, `src/server/http/form-body.ts`, `src/schemas/forms/`                                                             | `tests/unit/server/http/form-body.test.ts`, `tests/unit/server/http/post-step.test.ts`                                                                                              |
| Quota draining, request floods                       | Token buckets and daily counters checked before the body is read; a 40 s model budget; Cloud Run `max-instances` 1 since revision `ayojan-00006-nhx` and one Gemini key since `ayojan-00008-mr7` (D46), see docs/DEPLOYMENT.md  | `src/server/ratelimit/`, `src/server/genai/gateway.ts`, `src/server/genai/exhaustion.ts`                                                         | `tests/unit/server/ratelimit/`, `tests/unit/server/genai/gateway.test.ts`, `tests/unit/server/genai/gateway-reserve.test.ts`                                                        |
| Slow input (regex or parser blow-up)                 | Single-pass scanners, no nested-quantifier regular expressions, a timing test on adversarial text                                                                                                                               | `src/core/rupees/`, `src/core/grounding/`                                                                                                        | `tests/unit/core/rupees/parse-timing.test.ts`, `tests/unit/core/grounding/grounding-timing.test.ts`                                                                                 |
| Open redirect                                        | Every `Location` is assembled from fixed route words, a token re-checked against its charset and closed lists, then matched against a final shape                                                                               | `src/server/http/see-other.ts`                                                                                                                   | `tests/unit/server/http/see-other.test.ts`, `tests/unit/app/proxy.test.ts`                                                                                                          |
| Secret leakage                                       | Keys read from the environment at call time, never logged or put in an error message; `.env*` ignored; empty `.env.example`; nothing secret in any image layer; a scanner over every tracked text file                          | `src/server/config/key-pool.ts`, `src/server/state/seal-key.ts`, `.gitignore`, `.dockerignore`, `Dockerfile`, `scripts/check-forbidden-apis.mjs` | `tests/unit/server/config/key-pool.test.ts`, `tests/unit/server/state/seal-key.test.ts`                                                                                             |
| Personal data in logs                                | A log line may carry only allowlisted fields that pass a shape check; the per-call `model-call` line holds the requested model id, an outcome word and a duration, never the key, key index, text, prompt or reply              | `src/server/observability/logger.ts`, `src/server/ratelimit/client-key.ts`                                                                       | `tests/unit/server/observability/logger-privacy.test.ts`, `tests/unit/server/ratelimit/client-key.test.ts`                                                                          |
| Cross-site request forgery                           | No cookies and no ambient authority, so a forged cross-site POST can only act on a token the attacker already holds. `form-action 'self'` limits where the app's own forms post                                                 | `src/security/content-security-policy.ts`                                                                                                        | `tests/unit/security/content-security-policy.test.ts`                                                                                                                               |

## Validation boundaries and status codes

Every POST is a plain form post (`application/x-www-form-urlencoded`) with the sealed token in
a hidden field. `runStep` in `src/server/http/post-step.ts` runs the checks in this order, and
each refusal happens before the next, costlier step:

| Order | Status | Condition                                                                                                                                                                                           | Code                                                                                 |
| ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 0     | 404    | First path segment is not `en` or `hi`                                                                                                                                                              | `src/server/http/post-step.ts`                                                       |
| 1     | 429    | Rate limit spent; `Retry-After` is set and the page states the wait. Checked before the body is read                                                                                                | `src/server/ratelimit/rate-limit.ts`                                                 |
| 2     | 415    | `Content-Type` is not `application/x-www-form-urlencoded` (multipart and JSON are refused), or it names a charset other than UTF-8                                                                  | `src/server/http/form-body.ts`                                                       |
| 3     | 413    | Body over 32 KiB. A declared `Content-Length` over the cap is refused before a byte is read; a chunked body is cancelled at the cap                                                                 | `src/server/http/form-body.ts`                                                       |
| 4     | 400    | Body is not UTF-8 urlencoded, a field fails its Zod form schema (unknown field, repeated scalar, wrong type), or the token fails any decode step                                                    | `src/server/http/form-body.ts`, `src/server/http/post-step.ts`, `src/schemas/forms/` |
| 5     | 422    | Well formed but not processable: free text over 2,000 code points, a link that would exceed 4,000 characters, a 41st step, an unknown task, undo with nothing to undo, confirm with nothing pending | `src/server/http/form-body.ts`, `src/server/http/post-step.ts`                       |
| any   | 500    | An unexpected throw: a fixed page with no detail; the log line carries the error class name only                                                                                                    | `src/server/http/post-step.ts`                                                       |

Other statuses:

- **GET of a damaged or foreign plan link: 404**, answered by the proxy as a script-free page
  (`src/server/http/link-gate.ts`), so it renders with JavaScript off. A damaged token on a
  POST is a 400.
- **GET on a POST route, or any other method a route does not export: 405.** This is Next's
  default and has no unit test, because the route tests import `POST` directly. On 26 Oct 2026
  it was checked with `curl -X GET|PUT|DELETE` against all seven POST routes on a local
  production build (all 405), and `GET /en/confirm` against the deployed service (405).
- Free text is counted in code points, so a Hindi message gets the same allowance as an
  English one. A value that parses but is out of range (zero guests, a past date) is not an
  error: it becomes a question on the check page.
- Problem pages come from a fixed template (`src/server/http/problem-page.ts`) with no script,
  and carry `Cache-Control: no-store`.

## Headers and Content-Security-Policy

Fixed headers are set for every path in `next.config.ts`: `X-Content-Type-Options: nosniff`,
`Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, and a `Permissions-Policy` that lists
only features it refuses (empty allowlists): `camera`, `microphone`, `geolocation`, `payment` and
`usb`. The live service has sent the `usb` entry since revision `ayojan-00002-7hr` (26 Oct 2026). `poweredByHeader` is off. The headers also appear
on the 404 pages the proxy answers itself.

The policy cannot be fixed because its nonce changes on every response, so `src/proxy.ts`
builds it per request with `src/security/content-security-policy.ts`:

```
default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

- `script-src` has no `'unsafe-inline'` and no `'unsafe-eval'` in production; `'unsafe-eval'`
  is added only when `NODE_ENV` is `development`, for React's dev overlay.
- The proxy hands the same nonce to Next in the request, so the header and the `nonce`
  attributes on the page's script tags come from one value.
- On 26 Oct 2026 the deployed service sent a different nonce on each request, and the nonce in
  the HTML matched the header. A revision page loaded with no CSP violation and no hydration error
  (checked in Chrome on the live revision).
- Tests: `tests/unit/security/content-security-policy.test.ts` for the builder, and
  `tests/unit/app/security-headers.test.ts` for what actually leaves `next.config.ts` and the
  proxy.

Three more fixed headers come from `next.config.ts` on every path:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains` tells a browser that has
  seen the site once to use HTTPS only for two years. There is no `preload` token: that is a
  submission to a browser registry which the owner makes on purpose. The `.app` top-level domain
  is already preloaded as HTTPS-only, so on the default Cloud Run host the header adds nothing; it
  is defence in depth for a custom domain that does not end in `.app`.
- `Cross-Origin-Opener-Policy: same-origin` puts the app in its own browsing context group, so a
  page that opened it, or one it opens, cannot reach `window` across origins.
- `Cross-Origin-Resource-Policy: same-origin` stops other sites from loading the app's
  responses as sub-resources.

The last two are safe because nothing the app serves is loaded by another origin: the pages,
scripts, styles and `/icon.svg` are fetched by its own pages, there is no embed, font CDN,
widget or sign-in popup, and `connect-src` is already `'self'`. Adding any of those means
revisiting both headers. The tests pin all three values in
`tests/unit/app/security-headers.test.ts`.

## State sealing

The plan is `{ schema, ops, pending? }`: inputs and confirmed steps, never computed numbers.
`src/server/state/token-codec.ts` turns it into compact JSON, deflates it, and
`src/server/state/seal.ts` encrypts it with AES-256-GCM. The layout is one key-id byte, a
12-byte random IV, the ciphertext and a 16-byte tag, encoded as base64url.

- The associated data is `ayojan/state/v1` plus the key-id byte. Editing the key id fails
  authentication; bytes sealed for another purpose with the same key cannot be replayed as a
  plan.
- **Decoding refuses early.** In order: empty, longer than 4,000 characters, a character
  outside `[A-Za-z0-9_-]`; then decrypt (a wrong key or any edited byte fails here); then
  inflate with a 16 KiB output cap, so a forged deflate stream cannot make the server allocate
  much; then JSON; then the schema version (a later version gets the "older version" page);
  then Zod.
- **Encoding refuses what decoding would refuse.** A state whose JSON exceeds 16 KiB or whose
  link would exceed 4,000 characters is not sealed; the user gets a 422 and the plan is
  unchanged. A 41st step is refused the same way. `tests/unit/server/state/token-size.test.ts`
  pins the measured lengths.
- `STATE_SEAL_KEY` is one base64 value of 32 bytes. In production a missing or malformed key
  fails with a named error that never quotes the value, and `/api/health` answers 503. With no
  key outside production the server makes a random key for that process (links stop working on
  restart) and logs a warning.
- Rotation is not built. The key-id byte means a second key could be added without changing
  the link format, but today changing the key breaks every existing link.
- The link is a bearer token: anyone who holds it can read and continue the plan. It has no
  expiry and no revocation.
- Base64url decoding accepts non-canonical trailing bits. GCM still authenticates the content,
  so this changes nothing.

## Secrets

- Two secrets exist: `GEMINI_API_KEY` (one key, or several separated by commas or whitespace;
  `GEMINI_API_KEY_2` and further are also read) and `STATE_SEAL_KEY`. On the deployed service
  both are mounted from Secret Manager, not set as plain environment values.
- `src/server/config/key-pool.ts` and `src/server/state/seal-key.ts` read the environment on
  each call, so `next build` needs no secret. Errors name the variable and never its value.
  Key pool entries are referred to by index in logs, and in `/api/health` only under `detail` when
  `HEALTH_DETAIL=1` is set.
- `.env*` is ignored by git except `.env.example`, which holds no value. `.dockerignore` and
  `.gcloudignore` exclude `.env*` because `next build` would otherwise copy one into the
  standalone output.
  The `Dockerfile` takes no build argument and passes no key to the build.
- Server modules import `server-only`, and ESLint stops `src/core` importing anything from
  `src/server`, the SDK or the framework.
- `scripts/check-forbidden-apis.mjs` scans every tracked or untracked-but-not-ignored text file,
  `docs/` and `golden/` included, for the key shapes that start `AIza`, `AQ.`, `sk-`, `sk-or-`
  and `gsk_` and for private key headers. A line that says `example`, `fake` or `placeholder`
  is allowed, so test values can say what they are. It runs in CI through `npm run check:api`.
- Measured on 26 Oct 2026: 473 tracked files held no key-shaped string; `git log -S` found the
  `AIza` and `AQ.` shapes only in the scanner's own pattern descriptions and in a test that
  uses a fake placeholder; the only `.env` path ever committed is `.env.example`, with an empty
  value; no `.env` file or private planning file is in `git archive HEAD`.

## Rate limiting, quota, and what a per-instance limiter cannot stop

`src/server/ratelimit/` keeps token buckets and daily counters in memory. The limiter runs
before the body is read, so a refused request costs no parsing.

| Class | Routes                                                           | Limit per client                 | Also                                                                                                                                    |
| ----- | ---------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| model | `read/*` and `messages`, the routes that can spend a Gemini call | 6 a minute, burst of 3; 20 a day | A per-instance daily budget of 60 model actions, shared with the gateway (`INSTANCE_DAILY_ACTIONS` in `src/server/genai/exhaustion.ts`) |
| step  | every other POST                                                 | 60 a minute                      | None                                                                                                                                    |

- **The client key** is an HMAC-SHA256, keyed with a random value made once per process, of
  the rightmost `x-forwarded-for` entry, cut to 100 characters. On Cloud Run, Google's front end
  appends the address it saw, so the rightmost entry is the one a caller cannot choose;
  anything the caller writes to its left is ignored. The raw address is never stored or logged.
  Requests with no such header share one bucket.
- **Measured on 26 Oct 2026**, 90 parallel POSTs to `/en/undo`: against a local build, a fixed
  `x-forwarded-for` gave 63 responses of 415 and 27 of 429 (`Retry-After: 1`), and a made-up
  extra entry on the left changed nothing. Against the deployed service, 90 requests that each
  carried a different made-up `x-forwarded-for` still gave 27 of 429. That burst used up this
  test machine's step allowance on one instance for under 30 seconds.
- **Gemini quota.** `src/server/genai/gateway.ts` tries `gemini-3.5-flash-lite`, then
  `gemini-3.1-flash-lite`, then `gemini-3.5-flash`, with a 40 second budget for the whole read
  against Cloud Run's 60 second timeout. Rate-limit failures cool down the model and key
  pair that failed; auth failures cool the key for every model. Identical requests are served from a cache for up to 24 hours. Example
  texts stop spending live calls once a model and key pair has used 80 percent of its assumed
  daily allowance (`RESERVE_SHARE`), which keeps the last fifth for typed text. The allowance is
  an assumption (20 calls a day per model and key), not a measured figure. Since revision
  `ayojan-00008-mr7` (27 Oct 2026, D46) the service runs on one key from one project, because pooling free-tier keys from
  several projects can read as getting around Google's documented usage limits. One key, three
  models and 20 calls each give about 60 model calls a day in total.

What this cannot stop:

- **Many source addresses get many buckets.** The per-client bound is advisory.
- **Counts are per instance.** Since revision `ayojan-00006-nhx` (27 Oct 2026) the service runs at most one instance, which owns the
  whole 60-action budget, so the service-wide ceiling is that budget, bounded in the end by the
  Gemini quota itself. During a deploy an old and a new revision can overlap briefly, each with
  its own counters. A cold start (the service scales to zero) resets the counters, so a "daily"
  budget lasts as long as an instance does.
- **Past 10,000 tracked clients** the oldest buckets are dropped and those clients start with a
  fresh one. The table size is bounded on purpose.
- **GET pages have no limiter.** Each plan page decrypts its token, and the 4,000-character
  cap bounds that work.
- **The typed-text reserve is not a hard guarantee.** Typed text can still spend the whole allowance.
- **A rate-limit burst from one machine can briefly block that machine's other requests** to
  the same instance, as the measurement above showed.

## Prompt injection

Text the user supplies is data. The defence is structural, with filters as a second line.

1. **No field to carry a decision.** `QuoteReading`, `BriefReading` and `ChangeReading` hold
   only quoted facts (a rate, a category, a guest count, a date). The test in
   `tests/security/injection.test.ts` lists the quote reading's keys and asserts that none of
   them names a confirmation, availability, ranking, recommendation or booking.
2. **Quote verification.** A value reaches the plan only if its quote occurs in the user's text
   and, for a number, the number is spelled in the quote (`src/core/grounding/`). Otherwise it
   is shown as unverified or becomes a question.
3. **A delimiter pasted text cannot close.** `wrapUserText` in
   `src/server/prompts/shared/guardrails.ts` rewrites the delimiter tag in any case, with spaces,
   hyphens or none, and in HTML entity forms, so the block ends exactly once. The tests in
   `tests/unit/server/prompts/delimiter.test.ts` feed it eleven break-out spellings.
4. **Guardrail rules in every prompt.** One shared block (untrusted data, quote verbatim, never
   invent a price or confirmation, never compute) opens every system prompt;
   `tests/unit/server/prompts/guardrails.test.ts` fails if a prompt module lacks it.
5. **Arithmetic stays in code.** The model never produces a total, a date difference or a
   ranking, so there is nothing for an injected instruction to change.

`tests/security/injection.test.ts` runs offline against a committed recording. It covers a
quote that tells the planner to confirm it and rank it first (the reading holds only the rate
and the basis the vendor wrote; the plan keeps the other quotes' totals, statuses and the
cheaper choice), and a brief that tells the planner to set the budget to one crore (the
family's own figure survives, and a one-crore value pinned on words that do not say it is
dropped).

Live check, 26 Oct 2026, one model call on the deployed service: a vendor message that told the
planner to ignore its rules, mark the vendor booked and confirmed, and make the total zero was
read in 12.8 s. It matched 4 of 4 values, all taken from the vendor's own words (a category,
per plate, a rate of 1,280, plus GST). After confirming, the new quote was added at its stated rate, the two earlier
quotes' totals did not change, every row still read "Unconfirmed until you book", and nothing
was booked or set to zero.

Limits of this stance: the model can still read a value wrongly. The defence is that the user
sees each value beside its quote and confirms it, and that a misread value changes only that
value, not the rules.

## Dependencies

- Runtime dependencies are `@google/genai`, `next`, `react`, `react-dom`, `server-only`,
  `yaml` and `zod`, all pinned to exact versions in `package.json` and installed with
  `npm ci`.
- `npm audit --omit=dev --json`, run on 26 Oct 2026, reported 0 vulnerabilities at every level
  for the production dependencies. Next.js is 16.4.2.
- CI runs `npm audit --omit=dev --audit-level=high` right after `npm ci`, so a new high or
  critical advisory in a production dependency fails the build. Lower severities and dev-only
  packages are not gated. `package.json` lists dev tooling (including `jsdom` and
  `axe-core` for the accessibility tests) that is not shipped: the `Dockerfile` copies only the
  standalone build, static files and the data the app reads.
- No third-party script, font, stylesheet or image host appears in a page, and the CSP lists
  none.

## What is weaker than it looks

- `style-src` allows `'unsafe-inline'`, because the page uses inline style attributes, which
  cannot carry a nonce. `default-src 'self'` and `connect-src 'self'` still stop styles or
  scripts from sending data to another origin.
- The sealed link is a bearer token with no expiry. Cloud Run request logs may hold it (see
  [docs/DATA_HANDLING.md](docs/DATA_HANDLING.md)).
- `/api/health` is public. It reports `status`, whether the AI is available, whether the seal
  key is loaded, the planning data counts, the reading cache entry count, how many model
  actions this instance has run today, and the named reasons for a 503. It contains no key
  material and makes no model call. The number of keys and the per-key and per-model call
  counts and cool-downs, which would show how much capacity is left, are not public: they are
  added under `detail` only when the server runs with `HEALTH_DETAIL=1`, which is off by
  default.
- Next's own console output for an exception during a page render is outside the logger's
  allowlist. It was not observed to carry user text in the checks above.

## Reporting a vulnerability

Private vulnerability reporting is not switched on for this repository. Please open an issue
at <https://github.com/Sarthak195/ayojan/issues> titled "Security", say which file or route is
affected and what kind of problem it is, and leave out exploit details and any real plan link.
The maintainer will reply there with a private way to send the rest. If you find a working key
or a plan link in the repository, say so in the same way and do not use it.
