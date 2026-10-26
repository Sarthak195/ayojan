# ADR 0001: Every decision lives in a pure core

Status: Accepted, 26 Oct 2026

## Context

Ayojan shows numbers a family will act on: how a budget is split, what is over budget, which task
is late, which quote is cheaper. If any of these depends on the clock, the network, a file or a
random number, then two runs can disagree, a test needs mocks to pin it, and a reader cannot tell
by looking whether a figure was computed or fetched.

## Decision

All decisions are functions in `src/core`, and the linter enforces what "pure" means there.

- **No I/O, framework or SDK.** `eslint.config.mjs` forbids importing `node:*`, `fs`, `path`,
  `crypto`, `react`, `react-dom`, `next`, `@google/genai`, `yaml`, `pino`, `server-only`, and
  anything under `@/server`, `@/app` or `@/components` from `src/core`.
- **No clock and no randomness.** The same file forbids `new Date()` with no argument,
  `Date.now` and `Math.random` in `src/core`.
- **Time is an argument.** Functions take `today`, an `IsoDate` (a branded `YYYY-MM-DD` string)
  from [`src/core/calendar/day-number.ts`](../../src/core/calendar/day-number.ts). Dates are
  handled as whole day numbers by a hand-written calendar algorithm, because the built-in `Date`
  reads the machine's time zone. The server computes `today` in Asia/Kolkata in
  [`src/server/config/clock.ts`](../../src/server/config/clock.ts), the one place a plan's date is
  read from the wall clock.
- **Data is an argument too.** The planning data is loaded by the server and passed in as
  `PlanData` ([`src/core/plan/plan-data.ts`](../../src/core/plan/plan-data.ts)), so a test can hand
  the engines the real files or a variant.
- **Every rupee has a label.** A figure is a `Money` with a provenance (`your-number`,
  `your-split`, `from-quote`, `computed`, `assumption`) in
  [`src/core/money/money.ts`](../../src/core/money/money.ts), and amounts are whole rupees, so
  sums are exact.

The server layer (`src/server`) reads the clock, files and the network, calls the model, and hands
the results to the core. Pages in `src/app` only render what the core returned.

## Consequences

### Good

- A decision can be tested by calling a function with values. The tests under `tests/unit/core`
  use no mocks, stubs or spies.
- A plan view is reproducible: the same ops, data and `today` give the same JSON, so whole plan
  views are pinned as golden files.
- A reviewer can audit "the model never decides a number" by reading the import rules, not every
  call site.

### Costly

- Callers must thread `today` and the data through every layer, which makes signatures longer.
- Dates and rupee formatting are written by hand instead of using `Date` and `Intl`, so the
  repository owns that code and its edge cases.
- The lint rule bans a list of names. It is not a proof of purity: it does not stop `new Date(x)`
  with an argument, nor use of `Intl` or a mutable global. At HEAD `src/core` uses none of these,
  but nothing but review keeps it that way.

### Verified

- `npm run lint` (CI step "Lint") fails on any banned import or clock call in `src/core`; the
  rules are in [`eslint.config.mjs`](../../eslint.config.mjs).
- `tests/unit/core/**` runs with no `vi.mock`, `vi.spyOn` or `vi.fn`.
- [`tests/golden/change-test.test.ts`](../../tests/golden/change-test.test.ts) and
  [`tests/golden/over-budget.test.ts`](../../tests/golden/over-budget.test.ts) replay a plan with a
  fixed `today` and compare each whole version with the JSON under `tests/golden/plans`.
- [`tests/unit/core/calendar/day-number.test.ts`](../../tests/unit/core/calendar/day-number.test.ts)
  covers the calendar algorithm;
  [`tests/unit/server/config/clock.test.ts`](../../tests/unit/server/config/clock.test.ts) covers
  the server's clock.

## Rejected alternative

**Keep the purity as a convention, with engines free to read the clock and the data files.** The
code would be shorter, but every test of a deadline or a status would need a fake clock, a plan
opened late in the evening could show a different status in another time zone, and "the model
never decides" would rest on a promise instead of an import rule that fails the build.
