# ADR 0006: Plain HTML forms, route handlers and 303 redirects, with no Server Actions

Status: Accepted, 26 Oct 2026

## Context

Every step of the loop changes the plan: read a brief, confirm it, mark a task done, add a quote,
apply a change, choose trade-offs, undo, ask for a message draft. The people using it may be on a
slow phone, on an old browser, or behind a script blocker, and a shared plan link is opened far
more often than it is edited. The step must be safe to reload, the back button must work, and the
boundary where untrusted input enters must be small enough to test directly.

## Decision

Every step is a plain HTML form that POSTs to a route handler, which answers with a 303 redirect to
a page that is a pure render of the new link.

- **Seven POST route handlers.** `confirm`, `enter/[kind]`, `levers`, `messages`, `read/[kind]`,
  `task` and `undo`, each a `route.ts` under `src/app/[lang]` ([`src/app`](../../src/app)). No file
  in `src` contains `'use server'`.
- **One runner, one order of checks.** [`runStep`](../../src/server/http/post-step.ts) handles the
  language (an unknown one is a 404 page), then the rate limit before a body byte is read (429 with
  `Retry-After`), then [`readForm`](../../src/server/http/form-body.ts): the content type must be
  `application/x-www-form-urlencoded` (415), the body at most 32 KiB (413), the shape valid for a
  strict Zod schema (400), and free text at most 2,000 code points (422). Then the step's own work,
  then sealing the new state (a link that would be too long, or a 41st step, gets a page and the
  plan stays unchanged), then the redirect. Any throw becomes a 500 page with no detail, and the log
  line carries the error's class name only.
- **The redirect cannot be steered.** [`see-other.ts`](../../src/server/http/see-other.ts) builds a
  relative `Location` from fixed route words, a token that matches the codec's charset and length,
  and closed lists (language, page, anchor, reason, lever ids), then checks the whole string
  against one pattern. No user text enters a URL, so there is no open redirect. It is relative
  because an absolute URL built from `request.url` came out as `http://0.0.0.0:8080` behind Cloud
  Run.
- **The state travels in a hidden field.** Every form carries the sealed token, which is exempt
  from the free-text cap because the codec already bounds it.
- **GET pages never change anything.** A page is a function of the link. The check page, the plan
  page and the others render from the token; the model is only called by a POST.
- **Two client islands, both optional.** [`copy-button.client.tsx`](../../src/components/islands/copy-button.client.tsx)
  and [`running-total.client.tsx`](../../src/components/islands/running-total.client.tsx) are the
  only `'use client'` files. Without JavaScript the copy button renders nothing and the page keeps
  a "select the text" line, and the lever running total shows the server's sentence, which
  Recalculate refreshes. The island looks up sentences the server computed and adds nothing up.
- **Not every redirect is a 303.** A page that has nothing to show for its section, such as the
  plan page while a first brief still waits on questions, calls `redirect()` to the page that has
  it, and Next answers that with a 307. It is a GET-to-GET hop built by the same `locationOf`.

## Consequences

### Good

- The whole loop works with JavaScript off. A reload or a back button never repeats a change.
- Each route is `POST(request)` returning a `Response`, so tests call it directly with a real
  `Request`, with no framework or browser, and the 415, 413, 400, 422 and 429 order is ours.
- Little client JavaScript runs, so there is little client state to get wrong.

### Costly

- Every step is a full page load. There is no inline validation and no optimistic update.
- A refused step shows a separate problem page with a link back, not an error beside the field.
- The repository owns a small urlencoded parser, the size cap and the status mapping that a
  framework could have provided.
- Each action needs its own form, hidden token field and route.

### Verified

- [`post-step.test.ts`](../../tests/unit/server/http/post-step.test.ts),
  [`form-body.test.ts`](../../tests/unit/server/http/form-body.test.ts),
  [`urlencoded.test.ts`](../../tests/unit/server/http/urlencoded.test.ts) and
  [`problem-page.test.ts`](../../tests/unit/server/http/problem-page.test.ts) cover the order of
  checks, each status and the `Retry-After` header.
- [`see-other.test.ts`](../../tests/unit/server/http/see-other.test.ts) covers the `Location`
  rules.
- [`tests/http`](../../tests/http) drives every route with real form posts. The `no-model-path`
  tests ([`tests/http/no-model-path.test.ts`](../../tests/http/no-model-path.test.ts) and its quote and
  change counterparts) show a step finishing, or falling back to the form twin, with no model.
- `grep -rn "use server" src` finds nothing, and the two `'use client'` files are the islands above.
- [`tests/a11y/axe.test.ts`](../../tests/a11y/axe.test.ts) checks the server-rendered HTML of every view in both
  languages.

## Rejected alternative

**Server Actions and client-side navigation.** Steps would feel faster and errors could show inline.
The cost is that the request encoding, error handling and redirect behaviour of each step would
belong to the framework instead of to a function that takes a `Request`. The order of the checks
could not be asserted in a plain unit test, and the loop would depend on client JavaScript where
today it depends only on HTML.
