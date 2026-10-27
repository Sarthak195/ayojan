# ADR 0007: Gemini through the Interactions API, exact pins and a three-model ladder

Status: Accepted, 26 Oct 2026

## Context

The Gemini API surface has moved, and a call written from older examples can compile and still be
wrong. Model ids change, a model can answer under a newer id than the one requested, free-tier
allowances are small and shared, and a slow model can take longer than a web request should wait.
The app has to read a user's text in a few seconds when it can, say honestly which model answered,
and fail into a working form when it cannot.

## Decision

All model calls use the Interactions API, one request shape built in one place, and a fixed ladder
of models.

- **One API, one file for the SDK.** The only call is `client.interactions.create`
  ([`client.ts`](../../src/server/genai/client.ts), the only file that imports `@google/genai`). The
  legacy `generateContent` call is rejected by `npm run check:api`
  ([`scripts/check-forbidden-apis.mjs`](../../scripts/check-forbidden-apis.mjs)), which runs in CI.
- **Exact pins.** `package.json` lists `@google/genai` at exactly `2.31.0`, with no range, and
  pins the rest of the toolchain the same way (Next.js 16.4.2, React and React DOM 19.3.1,
  TypeScript 6.0.3, Zod 4.6.7). The repository contract in [`AGENTS.md`](../../AGENTS.md) names
  `2.30.0` as the fallback and forbids anything below `2.29.1`; the code pins one version, not a
  range.
- **One request shape.** [`buildInteractionRequest`](../../src/server/genai/interactions.ts) sends a
  system instruction (the shared guardrails first, then the stable task text), then the user's
  text inside its delimiter, then the instruction. The reply is JSON against a schema derived from
  the Zod schema with the validation keywords the Gemini schema subset ignores removed, and Zod
  checks the reply again. Reasoning is set with `generation_config.thinking_level: 'low'`; the
  type makes `temperature`, `top_p` and `top_k` unassignable. Requests are not streamed. Every call
  sets `timeout_ms` and turns the SDK's retries off, because the ladder decides what follows a
  failure.
- **The ladder.** [`gateway.ts`](../../src/server/genai/gateway.ts) tries `gemini-3.5-flash-lite`
  (20 s), then `gemini-3.1-flash-lite` (12 s), then `gemini-3.5-flash`, which starts only when at
  least 15 s remain and is capped by what is left. One action has a 40 s budget against Cloud Run's
  60 s request timeout, and no call starts with under 6 s left. Amended 28 Oct 2026 (commit
  `57965e2`, live since revision `ayojan-00009-v7q`): the second rung now waits 18 s, not 12 s, so
  if the first two run to their timeouts 2 s are left, the third is not started and a read ends
  at 38 s. The `LadderModel` type names only
  these three, so `gemini-3.8-flash` (which did not answer within 90 s when probed on 26 Oct 2026)
  and preview models cannot be requested by mistake.
- **Keys and failures.** Keys come from `GEMINI_API_KEY` and `GEMINI_API_KEY_*`. The gateway
  classifies a failure by status ([`classify.ts`](../../src/server/genai/classify.ts)): a rate limit
  cools that model and key pair for an hour, an auth error cools the key for six hours, a retired
  model is cooled on every key for six hours, an overload cools the model for three minutes. A
  reply that is not valid JSON, or fails the schema, is treated as our bug and falls back to the
  form, not to a 500.
- **The answering model is reported as the API reports it.** The server may answer as a newer id
  than the one requested, so the gateway records `interaction.model` and never the requested id.
  If the reply names no model, the requested id is recorded with an `-unconfirmed` suffix.
- **No paid tier.** A paid last rung was considered and not built. No key comes from the billed
  Cloud Run project and no paid key was added, so the service is treated as a free-tier client,
  and [`docs/DATA_HANDLING.md`](../DATA_HANDLING.md) carries the disclosure that follows.

## Consequences

### Good

- A stale call shape cannot enter the repository unnoticed, and the whole request is visible in
  one function.
- A rate limit, a timeout or a retired model moves the read down the ladder or to the form instead
  of failing the page.
- The page shows the model that really answered, and recorded readings keep that id.

### Costly

- Exact pins mean updates are deliberate and manual.
- The timeouts, cool-down periods and the assumed allowance are configuration from one day's
  probe, not measurements of Google's limits. They are constants in the code and will need
  retuning.
- One action can wait up to 40 s, and the page says so under each read button.
- Cool-down memory and counters live in each instance, so up to three Cloud Run instances each
  learn about a failing model on their own. Amended 27 Oct 2026 (D46): the service now runs one
  instance on one key, so one memory sees every failure.
- Dropping the retries means a transient failure costs a rung rather than a second try.

### Verified

- [`gateway.test.ts`](../../tests/unit/server/genai/gateway.test.ts) covers the ladder, each
  timeout and the 40 s, 15 s and 6 s rules, cool-downs, the reported model id and the unconfirmed
  suffix.
- [`interactions.test.ts`](../../tests/unit/server/genai/interactions.test.ts) covers the request
  shape (JSON schema, low thinking, no streaming, no sampling knob, text inside the delimiter).
- [`client.test.ts`](../../tests/unit/server/genai/client.test.ts) and
  [`classify.test.ts`](../../tests/unit/server/genai/classify.test.ts) cover the single client per
  key and the failure classes.
- `npm run check:api` fails on the legacy call; the exact pins are visible in
  [`package.json`](../../package.json) and the lockfile.

## Rejected alternative

**The older `generateContent` call, or a free choice of model per call.** The older call is
familiar and widely documented. The cost is a request shape this project did not verify, a
sampling-parameter surface that conflicts with steering by thinking level, and model ids typed at
call sites where a preview or a slow model could slip in. A ladder fixed in one file and a type
that names its models costs a little flexibility and removes that class of mistake.
