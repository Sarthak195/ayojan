# ADR 0008: A form twin for every model step, honest labels and a quota reserve

Status: Accepted, 26 Oct 2026

## Context

The model reads text, but a model can be unavailable: the key may be missing, the free-tier
allowance for the day may be spent, a call may time out. The allowance is shared by everyone who
uses the deployed service, and one script could spend it all. The app also reuses readings and
shows recorded examples, and a reading that looks live when it is not would mislead the person
looking at it.

## Decision

Every model step has a plain form that produces the same typed values, every reading says where it
came from, and part of the quota is held back for text people type themselves.

- **A form twin for each reader.** The brief form (`/[lang]/form`), the manual quote form and the
  change form build the same confirmed values as their readers, with no model call. The brief form
  and the brief reader end in one resolver
  ([`confirm-brief.ts`](../../src/core/brief/confirm-brief.ts)), so the same facts give the same
  plan. Valid values go straight to the plan. A value that needs a question goes to the check page,
  marked "Entered by form". A read that cannot be made redirects to the form with a banner that
  names the reason (`quota`, `timeout` or `nokey`). No typed text travels in the redirect, so
  the form opens empty.
- **Four labels, always shown.** A reading is "Read by AI", "Read by AI (cached)" (the same prompt
  version, schema version and text were read recently, so no call was spent), "Example reading,
  recorded on <date>; your own words are read live", or "Entered by form", with the answering model
  taken from `interaction.model` ([`reading-outcome.ts`](../../src/server/pipeline/reading-outcome.ts)).
- **The cache is bounded and says what it is.** The reading cache is in process memory, keyed by a
  hash of the prompt id and version, the schema version, the text and anything else the prompt sees.
  It holds at most 200 entries, 2 MiB and 24 hours ([`reading-cache.ts`](../../src/server/genai/reading-cache.ts)).
  A refusal is cached too; an unavailable outcome never is.
- **Examples come from a recording.** The sample brief and the two sample quotes have a text in
  [`fixtures`](../../fixtures) and a recorded reply in [`golden/llm`](../../golden/llm), both
  copied into the image. When a model and key pair has taken 80 percent of its assumed daily
  allowance, an example text skips live calls on that pair, and if nothing can answer it is served
  from its recording, labelled as one, rather than sent to the form. A server with no key says so
  even for an example, so a deployment without a key cannot pass a recording off as a working
  reader.
- **Limits at the door.** [`rate-limit.ts`](../../src/server/ratelimit/rate-limit.ts) allows a
  client a burst of 3 and 6 a minute for steps that can call the model, and 20 such actions a day;
  other steps get 60 a minute. Each instance allows 120 model actions a day, which is the assumed
  pool (6 projects, 3 models, 20 requests a day) shared over 3 instances. Amended 27 Oct 2026
  (D46): the service runs on one key from one project and one instance, so the budget is 60
  model actions a day (1 x 3 x 20). The client key is a
  keyed hash of the rightmost `x-forwarded-for` entry, the one Google's front end appends and a
  caller cannot choose ([`client-key.ts`](../../src/server/ratelimit/client-key.ts)).

## Consequences

### Good

- Without a key, with the allowance spent, or when a call times out, the whole loop still works
  through the forms, and the page says why.
- Nobody is told a recorded or cached reading is a fresh one.
- One script cannot easily drain the day's allowance for everyone, and a typed text is kept a share
  that an example text cannot spend.

### Costly

- Two paths to the same plan must stay equal. They share a resolver and tests compare them, but it is
  ongoing work for every new field.
- The allowance, the number of projects and the reset time are assumptions written as constants
  ([`exhaustion.ts`](../../src/server/genai/exhaustion.ts)), not measurements.
- All counters, the cache and the cool-downs live in each instance's memory. A client with many
  addresses gets many buckets, limits multiply by up to the number of instances, and a cold start
  resets the day's counts.
- The reserve only keeps example texts out of the last fifth of an allowance. Typed text can still
  spend all of it, so a flood of typed requests can exhaust the pool. Amended 27 Oct 2026 (D46):
  with one instance the multiplication applies only during a deploy overlap, and the pool is one key.
- A cache miss on another instance spends a call again.

### Verified

- [`gateway-reserve.test.ts`](../../tests/unit/server/genai/gateway-reserve.test.ts): the 80
  percent line, the fallback to the recording, the keyless case, per-pair counts and the cache.
- [`reading-cache.test.ts`](../../tests/unit/server/genai/reading-cache.test.ts) and
  [`example-readings.test.ts`](../../tests/unit/server/pipeline/example-readings.test.ts): bounds,
  keys, matching on canonical text, and a recording made for another prompt version being ignored.
- [`reading-outcome.test.ts`](../../tests/unit/server/pipeline/reading-outcome.test.ts): the labels
  and the form outcome for each cause.
- [`tests/http/no-model-path.test.ts`](../../tests/http/no-model-path.test.ts),
  [`tests/http/quotes/no-model-path.test.ts`](../../tests/http/quotes/no-model-path.test.ts) and
  [`tests/http/change/form-twin.test.ts`](../../tests/http/change/form-twin.test.ts): each twin, and
  the change form giving the same plan as the model path.
- [`rate-limit.test.ts`](../../tests/unit/server/ratelimit/rate-limit.test.ts),
  [`token-bucket.test.ts`](../../tests/unit/server/ratelimit/token-bucket.test.ts) and
  [`client-key.test.ts`](../../tests/unit/server/ratelimit/client-key.test.ts): the limits and the
  client key.

## Rejected alternative

**Make the model the only path, and show an error when it fails.** It is less code and one path to
test. The cost is that a missing key or a spent allowance, which the free tier makes likely,
would leave the app unusable exactly when someone opens it. Quietly serving recorded readings for
any text was also rejected: it would look like a working reader while ignoring what the person
typed.
