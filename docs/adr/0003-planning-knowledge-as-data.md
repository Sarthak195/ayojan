# ADR 0003: Planning knowledge is data, and it holds proportions, not prices

Status: Accepted, 26 Oct 2026

## Context

A plan needs planning knowledge: how a budget is usually divided, which tasks an event has and in
what order, how many days a task takes, which trade-offs close a gap. That knowledge can be wrong
or contested, and it must be easy to read, change and review. It must not become a table of market
prices: nobody fetched and verified one, and a price shown as fact is the "AI inventing prices"
failure one step removed.

## Decision

Planning knowledge lives in five YAML files under [`data/`](../../data), validated when the server
loads them, and every rupee on screen comes from the user.

- **What the files hold.** [`budget-weights.yaml`](../../data/budget-weights.yaml) (two profiles,
  `wedding` and `celebration`, category weights, how much of each category grows with guests,
  floors, priority multipliers), [`tasks.yaml`](../../data/tasks.yaml) (tasks with dependencies,
  durations and lead times in days, what activates them, which category a task books),
  [`levers.yaml`](../../data/levers.yaml) (trade-offs), [`functions.yaml`](../../data/functions.yaml)
  (wedding functions) and [`vendor-questions.yaml`](../../data/vendor-questions.yaml). Occasions map
  to a profile in the data: the wedding uses the wedding profile and every other occasion uses the
  celebration profile.
- **Proportions of the user's own budget.** The split is weights applied to the budget the user
  typed, rounded to Rs 100 for budgets under Rs 1 lakh and to Rs 1,000 from Rs 1 lakh up. A task has a day count, not a
  cost. A lever saves a percentage of a category's projected amount, or is exact arithmetic on the
  plan. The only rupee amounts in a plan are the user's budget, shares of it, and numbers from a
  quote or booking the user supplied. At load, [`absolute-rupees.ts`](../../src/server/knowledge/absolute-rupees.ts)
  rejects any rupee word or number of four or more digits in a data file, comments included.
- **Each row states its basis.** Every row has `en` and `hi` text (the Hindi must be Devanagari),
  a `basis` that must read "Planning assumption chosen by the author: " followed by one line of
  reasoning, and a `reviewed` field. No row cites an outside source, survey or link, because none
  was fetched and verified; the schema rejects such words
  ([`planning-row.ts`](../../src/schemas/data/planning-row.ts)). The `reviewed` field records a
  review: at HEAD every row carries a note that it was reviewed with AI assistance at the author's
  request on 26 Oct 2026, which is not a domain expert's sign-off.
- **The split is frozen at the brief.** [`frozen-split.ts`](../../src/core/budget/frozen-split.ts)
  computes allocations once, from the brief's budget, guest count and priorities. A later change of
  budget, guests or date shows up as a gap and as trade-offs. Only "Move money" shifts rupees, as
  deltas beside the frozen amounts.
- **Validated at boot, closed in tokens.** Loading checks the schema, duplicate YAML keys, unique
  ids, dependencies and cycles, one row per enum value, and references across files
  ([`src/server/knowledge`](../../src/server/knowledge)). A failure names the file and row and
  `/api/health` answers 503. [`scripts/generate-ids.ts`](../../scripts/generate-ids.ts) writes the
  task, lever and question ids into `src/schemas/generated/ids.ts`, so a link naming a task that
  no longer exists fails to parse.

## Consequences

### Good

- Changing a weight, a lead time or a lever needs no TypeScript. [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
  gives the steps.
- Hindi and English labels for tasks, levers and questions live beside the numbers they describe.
- No figure in the plan can be mistaken for a market price, and every assumption is written down
  where a reviewer can read it.

### Costly

- The weights, lead times and percentages are one author's judgment. They are labelled as
  planning assumptions ("Your split (planning assumption)"), but a wedding planner may disagree
  with them.
- Freezing the split means a rise in guests shows as a gap, where some users would expect a new
  split. This is deliberate, because it lets a change push a plan over budget and be explained.
- There are only two profiles, so a puja or a community event gets the celebration profile.
- Editing the data can change golden plan views, and adding or removing an id needs a generated
  file to be regenerated and committed.

### Verified

- [`tests/unit/data.test.ts`](../../tests/unit/data.test.ts) checks ids, dependencies, cycles,
  category and must-have coverage, one profile per occasion, bilingual text, the basis rule and the
  no-rupee scan on every data file.
- [`tests/unit/server/knowledge.test.ts`](../../tests/unit/server/knowledge.test.ts) checks that a
  broken document is rejected naming file and row, duplicate keys are refused, and the repository
  loads once per process.
- `npm run validate` ([`scripts/validate-data.ts`](../../scripts/validate-data.ts), CI step
  "Validate the planning data") also fails when `ids.ts` is out of date.
- [`tests/unit/core/budget/allocation.test.ts`](../../tests/unit/core/budget/allocation.test.ts)
  and [`tests/golden/change-test.test.ts`](../../tests/golden/change-test.test.ts) cover the split
  and show it staying frozen across a change.

## Rejected alternative

**A built-in table of typical prices, or asking the model for typical prices.** It would make a
first plan look more concrete. It would also put numbers on screen that no one verified, that go
stale, that depend on city and season, and that the user cannot audit. Constants hard-coded in
TypeScript were rejected for a smaller reason: a weight change would need a code change, and the
per-row basis, review note and bilingual text could not be validated.
