# ADR 0005: The plan is a sealed list of steps in the link, with no database

Status: Accepted, 26 Oct 2026

## Context

A family shares a plan over WhatsApp and comes back to it days later. The product has no accounts.
Storing plans would need a database, a retention policy and a way to delete them, and would make
every family's budget and needs a thing the project holds. The plan also has to support Undo, a
"what changed" diff and a "kept" list, which are easier to get right if they are derived than if
they are stored beside the plan.

## Decision

The plan's state is a short list of confirmed steps, sealed into the URL.

- **State is inputs only.** The token holds `{ schema, ops, pending }`
  ([`state-token.ts`](../../src/schemas/plan/state-token.ts)). An op is one confirmed step:
  `briefConfirmed`, `quoteAdded`, `taskDone`, `taskDelayed`, `changeConfirmed` or `leversApplied`
  ([`op.ts`](../../src/schemas/plan/op.ts)). `pending` is a reading waiting for the user to check
  it, so reloading the check page never calls the model again. No computed number is stored.
- **The plan is a fold.** [`fold.ts`](../../src/core/plan/fold.ts) applies the ops in order and
  `planView` computes every number from the result, the data and `today`. Undo drops the last op
  (never the first), and the ledger, the revision diff and the Kept list are derived from the same
  ops. A delay is stored as an absolute date, so a link opened later shows the same schedule.
- **Sealed, not just signed.** [`seal.ts`](../../src/server/state/seal.ts) encrypts with AES-256-GCM:
  one key-id byte, a 12-byte random IV, the ciphertext and a 16-byte tag. The associated data is
  `ayojan/state/v1` plus the key-id byte, so editing the id fails as tampering. The JSON is deflated
  first and the result is base64url. The key is `STATE_SEAL_KEY`, 32 bytes, mounted from Secret
  Manager; production refuses to run without it, and development without it uses a key for that
  process only and warns ([`seal-key.ts`](../../src/server/state/seal-key.ts)).
- **Bounded on both sides.** There are at most 40 ops; the 41st step gets a page saying so. A
  link is at most 4,000 characters, so chat apps do not truncate it, and the inflated JSON at most
  16 KiB, so a forged payload cannot make the server allocate much. Decoding checks, in order,
  length, charset, decryption, inflation with the 16 KiB cap, JSON, schema version and the strict
  Zod schema ([`token-codec.ts`](../../src/server/state/token-codec.ts)). Encoding refuses any
  state the decoder would refuse, so the server never hands out a link it cannot open again.
- **The claim is stated.** The footer reads "We keep no database. Your plan is encrypted inside
  the link; Google Cloud request logs may hold the link." (`privacyFooter` in
  [`common.ts`](../../src/i18n/areas/common.ts)).

## Consequences

### Good

- No database, no stored personal data to protect, delete or migrate, and no outage mode where
  storage is down.
- Sharing a plan is sharing a link, and the contents of a link cannot be read or edited without
  the key.
- Undo, diff and Kept need no extra state, and the same ops always give the same plan.

### Costly

- The link is the only copy. Lose it and the plan is gone. Anyone who holds it can open and extend
  it, and there is no way to revoke it.
- Request logs may hold the link, which is why the footer says so. They cannot be read without the
  key.
- A typical link is long. A 19-step test session seals to 2,760 characters (a codec fixture, not
  a plan); a schema-maximum state does not fit in 4,000, so a step that would overflow is refused
  and the user must undo one.
- Two people extending the same link fork the plan; there is no merge.
- Changing the state format or the seal key makes old links open an "older version" or "damaged"
  page. Key rotation is not built, although the key-id byte leaves room for it.
- The family-update draft is too large for the link. It is kept in a per-instance memory cache, so
  a miss on another instance shows the template again.

### Verified

- [`seal.test.ts`](../../tests/unit/server/state/seal.test.ts): round trip, fresh IV each time,
  wrong key, changed associated data, short input.
- [`token-codec.test.ts`](../../tests/unit/server/state/token-codec.test.ts): the 4,000-character
  limit, a changed character, an inflate bomb, bad JSON, a later schema version, a forged 41st op.
- [`token-size.test.ts`](../../tests/unit/server/state/token-size.test.ts): sizes for the largest
  legal states and the 19-step session (`npx vitest run tests/unit/server/state/token-size.test.ts`).
- [`history.test.ts`](../../tests/unit/server/state/history.test.ts) and
  [`seal-key.test.ts`](../../tests/unit/server/state/seal-key.test.ts): the op cap, Undo, and the
  key rules.
- [`tests/unit/core/plan/fold.test.ts`](../../tests/unit/core/plan/fold.test.ts) and
  [`tests/golden/change-test.test.ts`](../../tests/golden/change-test.test.ts): the plan as a fold,
  and Undo restoring the earlier version.

## Rejected alternative

**Store each plan in a database under a random id.** Links would be short and revocable. The cost
is a datastore with its credential and failure modes, a record of every family's budget and
needs, retention and deletion duties, and a privacy statement that could not say "we keep no
database". A signed but unencrypted token was also rejected: the budget and the family's needs
would sit readable in every log line and chat preview that shows the URL.
