# Contributing to Ayojan

This page covers the changes people most often make: editing planning knowledge, changing or adding
a prompt, and getting a change through the checks. The rules every change must respect are in
[`AGENTS.md`](AGENTS.md), and the reasons behind the design are in the
[decision records](docs/adr).

## Set up and run the checks

Node 24 is required (see `.nvmrc`).

```sh
npm ci
npm run verify
```

`npm run verify` runs seven steps in order and stops at the first failure:

| Step       | Command              | What it checks                                                                                         |
| ---------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| Type check | `npm run typecheck`  | `next typegen`, then `tsc --noEmit`                                                                    |
| Lint       | `npm run lint`       | ESLint with strict type-aware rules, including the purity boundary of `src/core`                       |
| Data       | `npm run validate`   | Loads `data/*.yaml` the way the server does, and checks that `src/schemas/generated/ids.ts` is current |
| Tests      | `npm run test`       | The whole Vitest suite, offline: `tests/setup.ts` makes any network call throw                         |
| File size  | `npm run check:size` | No file in `src` or `scripts` is longer than 250 lines                                                 |
| Forbidden  | `npm run check:api`  | Banned patterns and key-shaped strings in every tracked and untracked file                             |
| Repo size  | `npm run check:repo` | The git object database, history included, is under 9 MB (the contest cap is 10 MB)                    |

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `npm audit --omit=dev --audit-level=high` after `npm ci`, then the same steps, then `npm run build`,
with no API key. No test needs a key. `npm run format:check` (Prettier) is not part of `verify`, so
run `npx prettier --write` on the files you changed.

## The repository rules

[`AGENTS.md`](AGENTS.md) is the contract. In short, and with what enforces each rule:

- **Gemini through the Interactions API only**, `@google/genai` pinned exactly in `package.json`.
  `npm run check:api` rejects the legacy generate-content call.
  See [ADR 0007](docs/adr/0007-gemini-interactions-api-and-ladder.md).
- **`src/core` is pure.** No I/O, framework or SDK imports, no clock, no randomness; functions take
  `today` as an `IsoDate`. ESLint enforces it. See [ADR 0001](docs/adr/0001-pure-core.md).
- **The model never decides a budget, a schedule, a trade-off or a comparison.** Those are computed
  in TypeScript from `data/`. Text the user supplies is data: an instruction inside it must not
  change a decision. [`tests/security/injection.test.ts`](tests/security/injection.test.ts) guards
  this.
- **Every claim about user input carries a verbatim quote that code checks.** Failures are shown as
  unverified, not dropped. See [ADR 0002](docs/adr/0002-grounding-by-verbatim-quote.md).
- **Repository hygiene.** One branch, `main`. A 10 MB cap on the repository including history.
  No binaries. No banned strings: the legacy call, suppression comments for the linter or the type
  checker, markers for unfinished work, raw HTML injection, em dash characters, and anything shaped
  like an API key. A 250-line cap on files in `src` and `scripts` (tests are exempt). Comments say
  why, not what. `npm run check:api`, `check:size` and `check:repo` enforce the strings, the line cap
  and the size cap. One branch and no binaries are kept by review, not by a script.
- **Imports.** Across top-level areas (`src/core`, `src/schemas`, `src/server`, `src/components`,
  `src/i18n`, `src/app`) use the `@/` alias, for example `@/core/money/money`. Inside one feature
  folder (a route's `_change` or `_quote` folder, or a `src/core` area and its siblings) use relative
  paths. ESLint does not enforce this; review does. The purity rule for `src/core` is separate and
  is enforced.
- **Ids in comments.** A comment or test name may cite an id such as `FR-24`, `NFR-SEC-2` or `D18`.
  Ids in comments are defined in [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md); add a row there when
  you cite a new one, and do not cite an id that page does not define.
- **Next.js 16 is not the Next.js in most examples.** Read the matching guide in
  `node_modules/next/dist/docs/` before writing framework code, and heed deprecation notices
  (`src/proxy.ts` replaces `middleware.ts`).

Commit messages follow Conventional Commits (`feat`, `fix`, `docs`, `test` and so on, as in
`git log`). A change to a prompt or to planning data goes in the same commit as its tests, its
generated file and its log entry.

## Change planning knowledge without writing TypeScript

Budget weights, tasks, trade-offs, functions and vendor questions are data. Most changes to them
need no code. [ADR 0003](docs/adr/0003-planning-knowledge-as-data.md) explains why.

| File                                                       | What a row is                                                                                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`data/budget-weights.yaml`](data/budget-weights.yaml)     | A category's weight, its growth with guests and its floor, in the wedding or the celebration profile; the priority multipliers                        |
| [`data/tasks.yaml`](data/tasks.yaml)                       | A task: its category, dependencies, lead time and duration in days (and a shorter pair for the celebration profile), what activates it, what it books |
| [`data/levers.yaml`](data/levers.yaml)                     | A trade-off offered when a plan is over budget                                                                                                        |
| [`data/functions.yaml`](data/functions.yaml)               | A wedding function and the tasks it adds                                                                                                              |
| [`data/vendor-questions.yaml`](data/vendor-questions.yaml) | A question to ask a vendor, and what in the plan raises it                                                                                            |

Each file starts with comments that explain its fields. To change a row, or to add one by copying a
row of the same kind:

1. **Edit the YAML.** Every row needs `en` and `hi` text (the Hindi in Devanagari), a `basis` and a
   `reviewed` field. Labels and consequences shown to users live in the row, so no dictionary edit is
   needed.
2. **Follow the basis rule.** A `basis` is one line that starts exactly with
   `Planning assumption chosen by the author: ` and gives the reasoning. It never names a source,
   survey, report, study or link, because none was fetched and verified; the schema rejects those
   words. Leave `reviewed` empty until a person has actually reviewed the row, and put in it who
   reviewed it and when.
3. **Keep prices out.** Data holds proportions, percentages and day counts. A rupee word or a number
   of four or more digits anywhere in a data file, comments included, fails the load. The only
   exception is an ISO date in `reviewed`.
4. **Validate.** Run `npm run validate`. It checks the schema, duplicate keys, unique ids, that every
   dependency exists and does not form a cycle, one row per category, priority and occasion where
   that is required, and the references between files (a function's tasks must equal the tasks that
   name it). A task the small-celebration profile keeps must carry a `celebration` block whose day
   counts are no longer than the wedding's, and a wedding-only task must not. Each problem names
   the file and the row.
5. **Regenerate the ids if any id changed.** Adding, renaming or removing a task, lever or vendor
   question changes `src/schemas/generated/ids.ts`. Run `npm run generate:ids` and commit the file
   with the data. `npm run validate` and CI fail when the file is out of date.
6. **Run the tests.** The data tests and the golden tests must pass:

   ```sh
   npx vitest run tests/unit/data.test.ts tests/unit/server/knowledge.test.ts tests/golden
   ```

   The golden tests compare whole plan views with the JSON in `tests/golden/plans`, so a changed
   weight or lead time can legitimately change them.

7. **Re-pin a golden file only on purpose.** If a golden test fails and the new numbers are the ones
   you meant, read the diff first, then rewrite the pinned files:

   ```sh
   AYOJAN_PIN_GOLDEN=1 npx vitest run tests/golden          # bash
   $env:AYOJAN_PIN_GOLDEN = '1'; npx vitest run tests/golden  # PowerShell
   ```

   Unset the variable afterwards and run the tests again. Check `git diff tests/golden/plans` line
   by line, update the hand-check comment at the top of the test that owns the file if its figures
   changed, and commit the data, `ids.ts` and the pinned files together.

A change needs code when it goes beyond a row: a new category, occasion, must-have, diet, venue limit,
function name or activation condition (these are closed enums in
[`vocabulary.ts`](src/schemas/readings/vocabulary.ts) and the data schemas), or a new kind of lever
effect.

## Add or change a prompt version

The four prompts live in [`src/server/prompts`](src/server/prompts), are listed in
[`registry.ts`](src/server/prompts/registry.ts), and are logged in
[`docs/PROMPT_EVOLUTION.md`](docs/PROMPT_EVOLUTION.md). Each module exports `id`, `version`, `system`
and `instruction`. The system prompt is built with `composeSystem`, which puts the shared guardrails
first; keep it that way, and keep the stable text first and the user's text inside the delimiter.

To change an existing prompt:

1. **Edit the prompt and bump `version`** in its module. The version is part of the reading-cache key
   and of every recording, so old entries stop matching.
2. **Bump the schema version only if the reply schema changed.** It lives in
   [`schema-versions.ts`](src/server/pipeline/schema-versions.ts).
3. **Re-record the fixtures the prompt reads.** Recordings are the model's real replies, kept in
   [`golden/llm`](golden/llm) and replayed offline by
   [`tests/golden/replay.test.ts`](tests/golden/replay.test.ts), which fails on a recording made for
   another prompt or schema version. With `GEMINI_API_KEY` set in the environment:

   ```sh
   npm run record:golden -- --dry-run
   npm run record:golden -- --only brief-hinglish
   ```

   Recording spends shared Gemini quota (treated as free-tier), so name each fixture with `--only` and do not loop. The
   script records only fixtures that have no recording unless `--only` names one, stops at the first
   failure, refuses any flag it does not know, and refuses to write a recording that contains a key.
   Fixture texts are in [`fixtures`](fixtures); a file name starts with the prompt's prefix
   (`brief-`, `quote-`, `change-`, `family-update-`).

4. **Run the replay.** `npx vitest run tests/golden tests/unit/server/prompts`. Each reader fixture
   must verify at least 80 percent of its claims, and the replay prints "N of M verified". If it falls
   below, change the prompt, not the threshold.
5. **Log it in the same commit.** Add an entry to `docs/PROMPT_EVOLUTION.md` with the version before,
   the version after, why, and the evidence (the N of M figures from the replay and the model that
   answered the recording), and update the call-site table at the top. Only log a change that really
   happened.

To add a new prompt, also add the module to `PROMPTS` in `registry.ts` (a test fails if a module in
the directory is missing from it), add its route to `ROUTES` in
[`scripts/record-golden.ts`](scripts/record-golden.ts) (typed by prompt id, so leaving it out fails
the type check), add its schema version, add a case to
[`guardrails.test.ts`](tests/unit/server/prompts/guardrails.test.ts), add a fixture and extend the
replay test, and give it a reply schema with no field that could confirm, rank or book anything.

## Related reading

- [`README.md`](README.md): what the product does and how to run it.
- [`SECURITY.md`](SECURITY.md) and [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md): controls, tests
  and known gaps.
- [Decision records](docs/adr): why the design is the way it is.
- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md): what the ids in comments (`FR-24`, `D18`, "architecture 4.5") mean.
