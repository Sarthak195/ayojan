# Ayojan

[![CI](https://github.com/Sarthak195/ayojan/actions/workflows/ci.yml/badge.svg)](https://github.com/Sarthak195/ayojan/actions/workflows/ci.yml)

Ayojan (आयोजन, Hindi for organising an event) is a web planner for celebrations. You describe the event in your own words, in English, Hindi or Hinglish. Gemini reads the text into a small form that you check. From there, TypeScript does every calculation: the budget split, the task schedule, the vendor comparison and the trade-offs. When the family changes the plan, it is revised in place and shows what moved.

- Live app: https://ayojan-626015685685.asia-south1.run.app
- Repository: https://github.com/Sarthak195/ayojan
- Languages: English and Hindi, each page under `/en` or `/hi`

The one-line rule behind the code: **Gemini reads, code decides.**

## Chosen vertical

The vertical is the **Celebration and Event Planner**, and the problem it picks is the one that
hurts after the first plan exists: **absorbing a family's changes without starting over.**

**The persona.** Neha, 29, a QA engineer in Pune, is coordinating her brother's wedding in Indore for her parents. The budget is about Rs 8 lakh, there are about 200 guests, and the wedding is four months away. Decisions arrive in the family WhatsApp group in Hinglish ("Mausi ki side se 50 log aur", "budget thoda kam karo"). Vendor quotes arrive as WhatsApp texts, each in its own shape: a rate per plate with a minimum, a lump sum, "GST extra" with no rate. She keeps a spreadsheet and rebuilds it after every message. Her Nani uses a wheelchair. Her parents read more easily in Hindi.

**A general planner, with the wedding as the worked case.** The form twin and the check page have an occasion picker: wedding, birthday, anniversary, puja, community event or other celebration ([`src/schemas/readings/vocabulary.ts`](src/schemas/readings/vocabulary.ts)). A wedding uses the wedding budget profile. The other five use the celebration profile, which has its own category labels and weights ([`data/budget-weights.yaml`](data/budget-weights.yaml)). Five wedding-only tasks (the mandap design, the haldi, the sangeet, the printed invitation cards and the menu tasting) are dropped from a celebration plan by a flag in [`data/tasks.yaml`](data/tasks.yaml), and every other task has a second, shorter pair of day counts for the celebration profile, because a birthday is planned days or weeks ahead, not months: a party a week away is At risk, not Late. The app tells the user when the celebration profile is in use, and its numbers are planning assumptions.

**Who is it for, what is stressful, how does GenAI help?**

1. _Who:_ the one family member who ends up coordinating the event on a phone, for relatives who decide.
2. _What is stressful:_ the ripple of a change. More guests, a smaller budget or an earlier date changes the money, the deadlines and which quote is cheapest all at once. She has to work out what moved before her parents ask.
3. _Where GenAI earns its place:_ a rule or a regular expression cannot reliably read loose Hinglish or a WhatsApp quote. Gemini reads three kinds of text (the brief, a vendor quote, a change message) into a fixed schema. It does not decide anything that someone may act on.

### Problem statement alignment

The capabilities below are quoted from the Challenge 5 explainer session (Hack2skill, 23 Oct 2026, https://www.youtube.com/watch?v=fdi63eSyyYM). Timestamps are minutes and seconds into the video.

<!-- prettier-ignore -->
| Capability, quoted | Modules | How it is met |
| --- | --- | --- |
| **E1 Intake by practical questions.** "ask a few practical questions like what's the occasion, what's your budget, how many people" [15:22-15:29]; "a plan that reflects the user situation" [15:55] | [`src/server/pipeline/read-brief.ts`](src/server/pipeline/read-brief.ts), [`src/core/brief/questions.ts`](src/core/brief/questions.ts), [`src/schemas/readings/brief-reading.ts`](src/schemas/readings/brief-reading.ts) | One text box, or a form with the same fields. Occasion, budget, guests, date, venue capacity, functions, a priority per category ("invest more", "standard", "save"), must-haves, guest needs, diet and venue limits are read. A value the model cannot quote, or that is vague ("Feb end mein"), becomes a question with no default. |
| **E2 Budget allocation and scenarios.** "categorize the major expenses" [16:19-16:22]; "if the guest count increases, it could help them identify which cost" [16:53-17:00]; "We don't want an AI inventing prices and presenting them as a confirmed cost" [17:27-17:35] | [`src/core/budget/allocation.ts`](src/core/budget/allocation.ts), [`projection.ts`](src/core/budget/projection.ts), [`reallocation.ts`](src/core/budget/reallocation.ts), [`src/core/money/money.ts`](src/core/money/money.ts) | The user's own budget is split into seven categories by weights in `data/`. No market price exists anywhere in the code. Every rupee amount is a `Money` value with a provenance label (your number, your split, from a quote, computed, planning assumption), so an unlabelled amount does not type-check. A guest change moves only the per-guest share of each category. "Move money" shows what spending more on one category does to the others. |
| **E3 Timeline.** "turn a vague goal like, 'Help me to organize my wedding.' into a very structured sequence of tasks" [18:20-18:26]; "the venue booking is delayed, the assistant can help identify which other tasks might need your attention" [18:57-19:01] | [`src/core/timeline/schedule.ts`](src/core/timeline/schedule.ts), [`status.ts`](src/core/timeline/status.ts), [`task-selection.ts`](src/core/timeline/task-selection.ts), [`data/tasks.yaml`](data/tasks.yaml) | 20 task templates with dependencies and a latest finish measured back from the event date (with shorter lead times for the celebration profile). Code orders them, computes slack and the critical path, and labels each Done, Late, At risk, Due this week or On track (a word and an icon, never colour alone). Marking a task done or delaying it moves its dependants and lists them with the reason. |
| **E4 Over-budget trade-offs.** "help the family understand the trade-offs and choose what matters them the most" [20:04-20:09]; "help users make informed choices, not impose the AI's ideas of the perfect event" [21:11-21:19] | [`src/core/levers/lever-options.ts`](src/core/levers/lever-options.ts), [`selection.ts`](src/core/levers/selection.ts), [`data/levers.yaml`](data/levers.yaml) | Seven levers, each with its saving computed for the current plan, a consequence sentence and a provenance label. Nothing is pre-selected and nothing is cut for the user. A lever that would cut a category the user marked "invest more" is shown refused, with its saving, and can be shown anyway unless that category is already booked. A lever that conflicts with a must-have is disabled with the reason. A running line shows the effect of the ticked boxes. |
| **E5 Vendor coordination.** "help users define what they need from each vendor, and prepare questions to ask them, organize the quotation" [22:11-22:23]; "the AI shouldn't here claim that a vendor is available or the price is confirmed" [22:58-23:06] | [`src/server/pipeline/read-quote.ts`](src/server/pipeline/read-quote.ts), [`src/core/quotes/comparison.ts`](src/core/quotes/comparison.ts), [`comparable-total.ts`](src/core/quotes/comparable-total.ts), [`break-even.ts`](src/core/quotes/break-even.ts), [`vendor-questions.ts`](src/core/quotes/vendor-questions.ts) | A pasted WhatsApp quote is read into a schema that has no field for confirmation, availability or ranking. Code prices each quote at the plan's current guest count and compares it with the category's split. Tax is never assumed. A lump sum above its guest cap is never scaled, and becomes "re-quote needed". The comparison shows what is included, how many guests are covered, extra charges and what still needs asking. Every column reads "Unconfirmed until you book". Questions to ask each vendor come from templates in [`data/vendor-questions.yaml`](data/vendor-questions.yaml), and a message per vendor is rendered from the plan ([`src/core/messages/vendor-messages.ts`](src/core/messages/vendor-messages.ts)). |
| **E6 Personalised ideas.** "It should always ask, listen, and adapt" [25:23-25:27]; "the practical limitations of the venue, too" [24:31-24:33] | [`src/schemas/readings/vocabulary.ts`](src/schemas/readings/vocabulary.ts), [`src/core/timeline/task-selection.ts`](src/core/timeline/task-selection.ts), [`src/core/quotes/vendor-questions.ts`](src/core/quotes/vendor-questions.ts) | Partly met: by asking, not by generating concepts. Guest needs (elderly, children, wheelchair), diet, venue limits and must-haves change which tasks are on the plan, which levers are allowed and which questions go to vendors. Anything else the user names is kept as a verbatim note, shown as noted and never used in a decision. The levers answer "too expensive, propose alternatives". Theme or idea generation is deliberately not built, because an idea cannot be quoted from the user's text and so cannot be checked (see [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md#it-suggests-no-themes-or-ideas)). |
| **E7 Scope.** "pick a user or a user persona, and a specific challenge you're trying to solve" [26:08-26:15] | Not a module: see Chosen vertical | One persona, one challenge (the change), with the wedding as the worked case and the occasion picker for the rest. |
| **E8 Three questions.** "What's the most stressful or confusing part of the planning their event?" [27:15-27:19] | Not a module: see Chosen vertical | Answered above, under "Who is it for, what is stressful, how does GenAI help?" |
| **E9 The change test.** "we have got a 50 more guests now, our budget has decreased a bit, and the event is happening 2 weeks earlier. Does your application help them revise the plan, or does the user have to start from the scratch?" [28:03-28:18] | [`src/core/plan/fold.ts`](src/core/plan/fold.ts), [`diff.ts`](src/core/plan/diff.ts), [`kept.ts`](src/core/plan/kept.ts), [`reconfirmation.ts`](src/core/plan/reconfirmation.ts), [`tests/golden/change-test.test.ts`](tests/golden/change-test.test.ts) | The user pastes the sentence. Guests, budget and date are read with their quotes. A vague "decreased a bit" is asked as "By how much?" and never guessed. The revision page shows a diff of money, deadlines and quote ranking, a list of what was kept, which vendors must re-confirm (for example a venue booked for 220 guests now needing 250), and Undo. The whole change test is replayed offline, version by version, against pinned plan views. |
| **E10 Principles.** "keep the user in control, be transparent about the estimations, and don't add the feature just because they sound impressive" [29:20-29:27] | [`src/core/money/money.ts`](src/core/money/money.ts), [`src/core/grounding/verification.ts`](src/core/grounding/verification.ts) | Nothing is applied until the user confirms it. Every estimate is labelled with where it came from. The feature list is short on purpose: no vendor marketplace, no guest list, no payments. |

## Approach and logic

Every output is one of three kinds, and only the first and the third involve a model:

- **Interpretation (I):** free text becomes a shallow, closed schema. Three readers: the brief, a vendor quote, a change message. Every value must come with a verbatim quote.
- **Decision (D):** anything someone may act on (money, dates, comparisons, trade-offs, questions to ask). Pure TypeScript over the user's confirmed values and the files in `data/`. The model has no part in it.
- **Generation (G):** one labelled draft of a family WhatsApp update, written from facts the code supplies. Code rejects the draft if it contains any number that is not in the plan.

### The big ideas

1. **Gemini reads, code decides.** The model's schemas are its whole vocabulary: closed enums, no field for confirmation, availability, ranking or a total. Budgets, schedules, comparisons and trade-offs are computed in [`src/core`](src/core) from [`data/`](data). Text the user pastes is data, wrapped in a delimiter and never treated as instructions ([`src/server/prompts/shared/guardrails.ts`](src/server/prompts/shared/guardrails.ts)).
2. **Every claim carries a quote, and code checks the quote.** Each value the model returns comes with the words it came from. [`src/core/grounding`](src/core/grounding) finds the quote in the input (exact first, then with whitespace, emoji, smart quotes and WhatsApp timestamps normalised) and, for numbers, parses the number out of its own quote with an Indian-number parser that understands lakh, crore, "k", Devanagari digits and Hindi number words. The check page shows each value beside its quote and "N of M values matched your words". A value that fails is shown as unverified, never dropped and never silently accepted.
3. **Unknowns become questions.** Every field is three-valued (present, absent, unclear). An unclear or unverified value turns into a question with no preselected answer. A brief cannot be confirmed without an occasion, budget, guest count and date. The rest can stay "not sure".
4. **The plan lives in the link, with no database.** The plan is a list of confirmed operations (brief, quote, task done, task delayed, change, levers applied). Everything on screen (the plan, the ledger, the diff, the kept list, Undo) is derived by folding that list ([`src/core/plan/fold.ts`](src/core/plan/fold.ts)). The list is compressed and sealed with AES-256-GCM into the URL path ([`src/server/state/seal.ts`](src/server/state/seal.ts), [`token-codec.ts`](src/server/state/token-codec.ts)). Sharing the link shares the plan. A link that is edited, truncated or sealed with another key is refused.
5. **A form twin for every model step.** Each reading (brief, quote, change) has a plain form that produces the same validated object and the same operation, with no model call. If Gemini is out of quota, times out or the server has no key, the app says why and shows the matching form. The check page, when there is a reading, is pre-filled only with what was verified. The whole loop works without a model and without JavaScript ([`tests/http/no-model-path.test.ts`](tests/http/no-model-path.test.ts)).

## How it works

The loop: **Tell** (paste a brief), **Check** (confirm or correct the reading), **Plan** (money table, timeline, ledger), **Quote** (paste vendor quotes, compare), **Change** (paste a change, read the diff), **Choose** (tick trade-offs), **Undo**, **Message** (a family update and a message per vendor).

```
  Browser: HTML forms, no client JavaScript needed for the loop
     |  POST text or form fields                    ^  HTML pages
     v                                              |
 ==== network edge: Cloud Run, one Next.js container ==========================
  src/proxy.ts           nonce CSP, language, damaged-link 404
  src/server/http        body cap, rate limit, Zod on every form
     |
     +-- form twin (no model) --------------------------------------+
     |                                                              |
     +-- src/server/pipeline/read-*.ts                              |
           canonical text, wrapped in a delimiter                   |
              |                                                     |
              v                                                     |
        src/server/genai/gateway.ts ---- HTTPS ---> Gemini API      |
           ladder, timeouts, cache <--- JSON reply: schema + quotes |
              |                         (the model's part ends here)|
              v                                                     |
        src/core/grounding   quote found in the input? number in     |
                             its own quote?                         |
              |                                                     |
              v                                                     |
        check page: the user confirms, corrects or cancels <--------+
              |
              v
        one confirmed operation appended to the sealed state in the URL
              |
              v
   src/core  (pure: no network, no clock, no randomness)
        fold(operations, data/*.yaml, today) -> plan view
              |
              v
        server-rendered HTML; the new link carries the new plan
```

Gemini is the only outbound call the server makes. Nothing in `src/core` can reach the network, because the lint rule below forbids the imports that would let it.

**Pages.** Start, form, check, plan, quotes, revision and messages, in English and Hindi. Two small client components exist: the Copy button on the messages page and the running total on the revision page. Everything else is server-rendered HTML and ordinary form posts.

**Reading a text.** `POST /[lang]/read/[kind]` canonicalises the text, wraps it in a delimiter, and asks the gateway for a reading. The result is sealed into a link and the user is sent to the check page, so reloading never calls the model again. Nothing enters the plan until the user confirms.

**Today's date.** Every function in `src/core` takes `today` as an argument. The server computes it in Asia/Kolkata ([`src/server/config/clock.ts`](src/server/config/clock.ts)).

## GenAI used

The canonical account is [`docs/GENAI_SERVICES.md`](docs/GENAI_SERVICES.md). If it and this README ever disagree, that file is the one to trust. Prompt versions and why each changed are in [`docs/PROMPT_EVOLUTION.md`](docs/PROMPT_EVOLUTION.md).

**Call sites.** Four prompts, all through one method, `LlmGateway.extract` ([`src/server/pipeline/llm-gateway.ts`](src/server/pipeline/llm-gateway.ts)), all registered in [`src/server/prompts/registry.ts`](src/server/prompts/registry.ts):

| Prompt         | Used for                                   | Schema              | File                                                                         |
| -------------- | ------------------------------------------ | ------------------- | ---------------------------------------------------------------------------- |
| `brief`        | Read the first brief                       | `BriefReading`      | [`src/server/prompts/brief.ts`](src/server/prompts/brief.ts)                 |
| `quote`        | Read one vendor quote                      | `QuoteReading`      | [`src/server/prompts/quote.ts`](src/server/prompts/quote.ts)                 |
| `change`       | Read a change message                      | `ChangeReading`     | [`src/server/prompts/change.ts`](src/server/prompts/change.ts)               |
| `familyUpdate` | Draft a family WhatsApp update, on request | `FamilyUpdateDraft` | [`src/server/prompts/family-update.ts`](src/server/prompts/family-update.ts) |

**How a call is made.** `client.interactions.create` from `@google/genai`, pinned to exactly 2.31.0 ([`src/server/genai/interactions.ts`](src/server/genai/interactions.ts)). Reasoning is set with `generation_config.thinking_level` (always `low`); `temperature` is typed as `never`. The stable system prompt goes first, the untrusted text sits inside a delimiter, and the instruction comes last. Schemas are kept shallow. Every call sets `timeout_ms` and `store: false` (so the Interactions API keeps no copy for later retrieval), and the SDK's own retries are off. The answering model is the id the API reports in `interaction.model`, shown on the check page, not the id that was requested; a reply with no id is shown as the requested id marked unconfirmed.

**The ladder** ([`src/server/genai/gateway.ts`](src/server/genai/gateway.ts)). One action has a 40 second budget, against a 60 second Cloud Run timeout:

1. `gemini-3.5-flash-lite`, 20 s
2. `gemini-3.1-flash-lite`, 12 s
3. `gemini-3.5-flash`, only if at least 15 s of the budget remain

A call is not started with less than 6 s left. The gateway tries the configured keys in turn, cools a key or a model after a rate-limit, auth or overload error, and keeps an in-memory cache of readings so a repeat costs no call (shown as "read by AI (cached)"). An example text falls back to its committed recording when its share of quota runs low, and is labelled as a recording.

**Considered and rejected.**

| Option                                               | Why not                                                                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Vertex AI                                            | Needs billing and a service-account key. The app needs one API key, read from the environment.                                                |
| Firestore or any database                            | There is nothing to store: the plan is the sealed link.                                                                                       |
| Firebase Auth                                        | There is no account and no session to protect.                                                                                                |
| Search grounding                                     | The app never looks up a price. Nothing in the plan comes from the web.                                                                       |
| Cloud Translation                                    | One prompt reads English, Hindi and Hinglish and returns quotes in the original script. The interface text is data in [`src/i18n`](src/i18n). |
| Preview models, and `gemini-3.8-flash`               | `LadderModel` in `interactions.ts` names only the three ladder models, so another id cannot be requested by mistake.                          |
| A generation call for budgets, schedules or rankings | The model never decides them (AGENTS.md item 3).                                                                                              |

## Architecture

`src/core` holds every decision and is pure. The lint block that enforces it, quoted from [`eslint.config.mjs`](eslint.config.mjs):

```js
{
  files: ['src/core/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: PURE_CORE_IMPORTS,
            message:
              'src/core is pure: no I/O, framework or SDK. Move this to src/server and pass the result in.',
          },
        ],
      },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: "NewExpression[callee.name='Date'][arguments.length=0]",
        message: 'src/core must be deterministic: take `today: IsoDate` as a parameter.',
      },
      {
        selector: "MemberExpression[object.name='Date'][property.name='now']",
        message: 'src/core must be deterministic: inject the clock as a parameter.',
      },
      {
        selector: "MemberExpression[object.name='Math'][property.name='random']",
        message: 'src/core must be deterministic: inject randomness as a parameter.',
      },
    ],
  },
},
```

`PURE_CORE_IMPORTS` lists `node:*`, `fs`, `path`, `crypto`, `react`, `react-dom`, `next`, `@google/genai`, `yaml`, `pino`, `server-only`, and the app's own `@/server/*`, `@/app/*` and `@/components/*`. So a decision can be tested with no network and no mocks, and the same input always gives the same plan.

| Layer      | Path                                                     | Role                                                                                                                                        |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisions  | [`src/core`](src/core)                                   | Budget, schedule, quotes, levers, plan fold, grounding, number parsing and formatting, message checks. Pure.                                |
| Vocabulary | [`src/schemas`](src/schemas)                             | Zod schemas for the model's replies, forms, operations and the sealed state.                                                                |
| Knowledge  | [`data`](data)                                           | Budget weights, tasks, levers, vendor questions, functions: YAML, validated by `npm run validate`. Each row has a basis and a review field. |
| Server     | [`src/server`](src/server)                               | The gateway and prompts, the reading pipelines, the sealed state, HTTP guards, rate limiting, logging.                                      |
| Pages      | [`src/app`](src/app), [`src/components`](src/components) | Server-rendered routes and components, and the two client islands.                                                                          |
| Language   | [`src/i18n`](src/i18n)                                   | English and Hindi text.                                                                                                                     |

## Evaluator map

| Dimension                   | Claim                                                                                                                        | Where it is proved                                                                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem Statement Alignment | A change of guests, budget and date revises the plan in place, version by version, and Undo returns to the previous version. | [`tests/golden/change-test.test.ts`](tests/golden/change-test.test.ts) with the pinned views in [`tests/golden/plans`](tests/golden/plans); the same flow through the HTTP routes in [`tests/http/change`](tests/http/change) |
| Problem Statement Alignment | An over-budget plan offers trade-offs and applies none of them for the user.                                                 | [`tests/golden/over-budget.test.ts`](tests/golden/over-budget.test.ts)                                                                                                                                                        |
| Code Quality                | Decisions cannot import I/O, a framework or the SDK, or read the clock or randomness.                                        | [`eslint.config.mjs`](eslint.config.mjs)                                                                                                                                                                                      |
| Code Quality                | Files in `src` and `scripts` stay at 250 lines or fewer, and banned strings are rejected.                                    | [`scripts/check-file-size.mjs`](scripts/check-file-size.mjs), [`scripts/check-forbidden-apis.mjs`](scripts/check-forbidden-apis.mjs)                                                                                          |
| Security                    | An instruction planted in a pasted quote or brief cannot change a decision.                                                  | [`tests/security/injection.test.ts`](tests/security/injection.test.ts)                                                                                                                                                        |
| Security                    | The plan link is authenticated: any edited byte, or another key, is refused.                                                 | [`tests/unit/server/state/seal.test.ts`](tests/unit/server/state/seal.test.ts)                                                                                                                                                |
| Security                    | Fixed security headers and a per-request script policy on every response.                                                    | [`tests/unit/app/security-headers.test.ts`](tests/unit/app/security-headers.test.ts)                                                                                                                                          |
| Efficiency                  | Page weight is measured per page, and the loop needs no database.                                                            | [`scripts/measure-pages.mjs`](scripts/measure-pages.mjs)                                                                                                                                                                      |
| Testing                     | Every committed model recording is replayed through the real read pipeline, offline.                                         | [`tests/golden/replay.test.ts`](tests/golden/replay.test.ts)                                                                                                                                                                  |
| Accessibility               | axe-core finds no violation on any view in either language.                                                                  | [`tests/a11y/axe.test.ts`](tests/a11y/axe.test.ts), [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md)                                                                                                                          |

## Assumptions

- **Planning numbers are assumptions, and are labelled as such.** The budget weights, per-guest scaling shares, task lead times and lever percentages are chosen by the author, not drawn from market data. Each row in `data/` carries a `basis` sentence and a `reviewed` field. The original rows record an AI-assisted review at the author's request, not a professional planner's sign-off. The celebration lead times were added later and their `reviewed` field is empty: they are unreviewed planning assumptions. On screen they carry the "planning assumption" label.
- **No market prices.** The only rupee figures are the user's own (budget, bookings, quotes they paste) and amounts computed from them.
- **The split is frozen when the brief is confirmed.** A later change of budget, guests or priorities shows up as a gap against the original split, and the user decides how to close it. Only "Move money" shifts rupees between categories ([`src/core/budget/frozen-split.ts`](src/core/budget/frozen-split.ts)).
- **One headcount** applies to every function of the event.
- **A booking is a number the user enters.** Marking a task done with an amount books its category. Nothing is booked by the app, and a quote is "Unconfirmed until you book".
- **GST is never assumed.** A quote that says "GST extra" with no rate keeps its total marked as unsettled. A quote that is silent on GST is treated as unclear, not as included ([`src/core/quotes/tax.ts`](src/core/quotes/tax.ts)).
- **Vendors are named "Caterer A", "Caterer B" and so on.** The pasted message itself is never stored: only the structured values and short item labels enter the plan.
- **Dates are Indian Standard Time.** A date that has passed becomes a question, and the budget must be between Rs 5,000 and Rs 10 crore ([`src/schemas/plan/brief.ts`](src/schemas/plan/brief.ts)).
- **A plan has at most 40 operations**, and its link at most 4,000 characters, so that it survives chat apps. A plan past the cap is refused with a clear page.
- **Model quota is shared and assumed.** The gateway assumes a free-tier allowance per model and key and keeps a share for typed text (see [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md)).

## Run it locally

Requires Node 24 (see `.nvmrc`).

```sh
npm ci && npm run verify
```

`verify` runs the type check, lint, validation of the planning data, the tests, the 250-line file cap, the forbidden-pattern and leaked-key scan, and the repository size check. It needs no API key, because the tests run offline and any attempt to fetch fails the test. The CI workflow ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same steps, plus `npm audit --omit=dev --audit-level=high` right after `npm ci` and the build, with no key.

To run the app:

```sh
cp .env.example .env     # then set GEMINI_API_KEY
npm run dev              # http://localhost:3000
```

<!-- prettier-ignore -->
| Variable | Needed | What it is |
| --- | --- | --- |
| `GEMINI_API_KEY` | For model reads | One Gemini API key, or several separated by commas or whitespace. `GEMINI_API_KEY_2`, `_3` and so on are also read. Without a key the app still works through the forms and says so. |
| `STATE_SEAL_KEY` | Production only | One base64 value of 32 bytes, for example from `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. In development, if it is unset, the app uses a key for that process only and warns, so plan links stop working when the server restarts. In production the server refuses to run without it ([`src/server/state/seal-key.ts`](src/server/state/seal-key.ts)). |

`GET /api/health` reports status, whether the AI is available, whether the seal key is loaded, the size of the planning data, the reading cache entry count, today's model actions on this instance and the reasons for a 503, without returning any key (the key count and per-key and per-model counters need `HEALTH_DETAIL=1`). The deployment is a single Cloud Run service built from the [`Dockerfile`](Dockerfile), with both secrets mounted from Secret Manager; what was done is recorded in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Testing

On 27 Oct 2026, `npx vitest run` at commit `28c5d95` ended with:

```
 Test Files  117 passed (117)
      Tests  2427 passed (2427)
   Duration  31.31s
```

The suite runs offline: [`tests/setup.ts`](tests/setup.ts) makes any network call throw. What the main groups prove:

- **Pure core** ([`tests/unit/core`](tests/unit/core)): table-driven tests of the Indian-number parser, rupee formatting, quote matching, the budget split, scheduling, comparison, levers, the fold and the message checks.
- **Golden replay** ([`tests/golden/replay.test.ts`](tests/golden/replay.test.ts)): the 16 model recordings in [`golden/llm`](golden/llm), one per fixture text in [`fixtures`](fixtures), are replayed through the real pipeline, schema and quote checks by a fake gateway. It proves that the code around the model behaves on real model output (a vague date becomes a question, an injected quote has nowhere to land, a draft with a stray number is rejected) without spending quota. It does not test the model.
- **The change test, the over-budget case and a celebration** ([`tests/golden/change-test.test.ts`](tests/golden/change-test.test.ts), [`over-budget.test.ts`](tests/golden/over-budget.test.ts), [`celebration.test.ts`](tests/golden/celebration.test.ts)): each plan version is compared whole with a JSON file in [`tests/golden/plans`](tests/golden/plans).
- **Injection** ([`tests/security/injection.test.ts`](tests/security/injection.test.ts)): what the model can say about a planted quote, what the plan does with it, and what a planted instruction in a brief can reach. The answer is that it cannot change a total, a ranking or a status.
- **HTTP** ([`tests/http`](tests/http)): each route is driven with real form posts, including the paths that never call a model.
- **Accessibility** ([`tests/a11y/axe.test.ts`](tests/a11y/axe.test.ts)): every page and every problem page, in both languages, rendered in the real page shell and checked with axe-core.
- **Security and hygiene** ([`tests/unit/security`](tests/unit/security), [`tests/unit/app`](tests/unit/app), [`tests/unit/scripts`](tests/unit/scripts)): the script policy, the fixed headers, the repository guards.

**Critical path.** The steps a family depends on, and the folders that prove each:

<!-- prettier-ignore -->
| Critical step | What is proved | Tests |
| --- | --- | --- |
| Reading and grounding | A value counts only if its quote is in the user's words; a vague value becomes a question; planted instructions change nothing | [`tests/unit/core/grounding`](tests/unit/core/grounding), [`tests/unit/core/brief`](tests/unit/core/brief), [`tests/unit/server/pipeline`](tests/unit/server/pipeline), [`tests/golden/replay.test.ts`](tests/golden/replay.test.ts), [`tests/security`](tests/security) |
| Planning and the change test | The split, projection, schedule, quotes and levers are computed from data; a change revises the plan in place and shows what moved and what was kept; Undo | [`tests/unit/core/budget`](tests/unit/core/budget), [`tests/unit/core/timeline`](tests/unit/core/timeline), [`tests/unit/core/plan`](tests/unit/core/plan), [`tests/golden`](tests/golden), [`tests/http/change`](tests/http/change) |
| Sealing | The plan survives the link: encrypted, tamper-evident, size-capped, and a damaged link is refused | [`tests/unit/server/state`](tests/unit/server/state) |
| Plain forms and the no-model path | Every step works through a plain form and a 303 when no model call succeeds, and gives the same plan | [`tests/http/no-model-path.test.ts`](tests/http/no-model-path.test.ts), [`tests/http/enter.test.ts`](tests/http/enter.test.ts), [`tests/http/quotes`](tests/http/quotes), [`tests/http/change`](tests/http/change) |
| Accessibility | No automated axe violations on any page in either language; the focusable table scroll region and the read-button hints are unit-tested | [`tests/a11y`](tests/a11y), [`tests/unit/components`](tests/unit/components) |

**Coverage.** `npm run coverage` (`vitest run --coverage`) measures `src/core` only, on purpose: it holds every decision, whereas a figure over the whole app would average in framework glue. On 27 Oct 2026 it reported line coverage of 99.51% (2,275 of 2,286 lines) for `src/core`, with 97.06% of statements, 92.49% of branches and 99.14% of functions. The figure is a measurement, not a gate: the config sets no threshold.

A deployed URL is checked separately with `npm run smoke` (or `node scripts/smoke.mjs <url>`; the default is the Cloud Run service). [`scripts/smoke.mjs`](scripts/smoke.mjs) makes no model call: it checks the health route, distinct page titles in both languages, the fixed security headers, the form twin through to a plan page, a damaged plan link, a wrong method and the privacy sentence under the read button. It prints one PASS or FAIL line per check and exits non-zero on any failure. It needs a live URL, so it is not part of `verify` or CI.

## Performance, measured

Page weight comes from [`scripts/measure-pages.mjs`](scripts/measure-pages.mjs), run on 26 Oct 2026 against a fresh standalone production build of commit `6a71328`, served locally with no model key (every page is reached through the form twin, so no model call is made):

```sh
node scripts/measure-pages.mjs http://127.0.0.1:3600
```

| Page          | HTML raw  | HTML gzip |
| ------------- | --------- | --------- |
| Start (`/en`) | 15.3 KiB  | 3.8 KiB   |
| Form          | 56.3 KiB  | 6.6 KiB   |
| Check         | 68.3 KiB  | 8.1 KiB   |
| Plan          | 196.6 KiB | 15.4 KiB  |
| Quotes        | 47.4 KiB  | 6.7 KiB   |
| Revision      | 17.7 KiB  | 3.8 KiB   |
| Messages      | 18.9 KiB  | 4.1 KiB   |

- Every page except the damaged-link 404 loads the same five scripts: 445.3 KiB raw, 131.9 KiB gzip. That is the React and Next runtime. The loop does not need them, so the claim is that **no client JavaScript is needed**, not that the JavaScript is small. The revision page loads one extra chunk of 0.8 KiB and the messages page one of 0.7 KiB. The damaged-link 404 ships no script. The 110 KiB `noModule` polyfill is for old browsers only and is not counted.
- Most of the plan page's raw size is inline framework payload that repeats the page content. It gzips well, and the server sends gzip.
- The plan page takes the time of one decrypt and one fold. The link holds the whole plan, so no request waits on a database.
- One read of a Hinglish brief on the live app took 5.2 s and matched 5 of 5 values. That is a single observation, not a benchmark. The live app answered page requests in about 100 to 150 ms to first byte from the author's machine on 26 Oct 2026, over the author's own network.
- A model action has a 40 s budget and starts no call with under 6 s left, so a slow model cannot hold a request for the full Cloud Run timeout.
- Rate limits protect the shared quota, per instance: a model read allows a burst of 3 and 6 a minute, and 20 a day per client; other posts allow 60 a minute; the service runs on one Gemini key and one instance, which spends at most 60 model actions a day ([`src/server/ratelimit/rate-limit.ts`](src/server/ratelimit/rate-limit.ts), [`src/server/genai/exhaustion.ts`](src/server/genai/exhaustion.ts)).

## Accessibility

The app is built for a small phone, a slow connection, a keyboard, a screen reader, dark mode, and a browser with JavaScript off, in English or Hindi. axe-core reports no violations on any page or problem page in either language ([`tests/a11y/axe.test.ts`](tests/a11y/axe.test.ts)). Chrome Lighthouse accessibility scored 100 on the start, form, check, plan, quotes, revision and messages pages and on the Hindi plan page. Contrast was checked in a real browser in light and dark schemes, and layouts were checked at 360 px wide. Statuses use a word and an icon, never colour alone, and tables scroll inside a labelled region. The full list of what is built in, how it was tested and what is still open is in [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md).

## Security

- **Prompt injection.** Pasted text is data inside a delimiter. The model's schemas have no field for a decision, so a planted instruction has nowhere to land, and decision code works only on the structured values the user has confirmed. The injection test covers this.
- **State.** The plan link is AES-256-GCM sealed with a key that never leaves the server, a random nonce per link and associated data that binds it to this purpose. Decoding checks length, character set, authentication tag, an inflate size cap and the schema, in that order.
- **Headers.** Every response carries a Content-Security-Policy with a fresh nonce for each request (`script-src` uses `'self'`, the nonce and `'strict-dynamic'`, with no `unsafe-inline` or `unsafe-eval`), `frame-ancestors 'none'`, `form-action 'self'`, `nosniff`, a same-origin referrer policy and a Permissions-Policy that refuses powerful browser features.
- **Input.** Request bodies are capped and parsed with Zod. A malformed body is answered with a 4xx, never a 500. Every redirect is built from fixed words and a closed list.
- **Secrets.** Keys come from the environment (Secret Manager on Cloud Run) and are never logged. The logger writes only allowlisted, shape-checked fields, so pasted text and tokens cannot reach a log line. CI scans for key-shaped strings.
- **Rate limiting** is per instance and keyed on the address Google's front end appends, so a caller cannot choose their own bucket. A caller with many addresses still gets many buckets, and the limits are stated as such.

The detail, including what is weaker than it looks, is in [`SECURITY.md`](SECURITY.md). What is logged and what is never written is in [`docs/DATA_HANDLING.md`](docs/DATA_HANDLING.md).

## Limits

What Ayojan deliberately does not do: it gives no market prices, names or recommends no vendors, claims no availability, generates no theme concepts, keeps no guest list, takes no payments and keeps no database (the only server-side state is an in-memory reading cache and the rate-limit counters). A plan holds at most 40 operations. The rate limiter and the model quota are per instance and approximate. The planning numbers are assumptions, not data. The full list, with the reasons, is in [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

## Repo map

```
README.md  AGENTS.md  SECURITY.md  CONTRIBUTING.md  LICENSE
eslint.config.mjs        the purity boundary for src/core
next.config.ts           standalone build, fixed security headers
Dockerfile               the Cloud Run image
.github/workflows/ci.yml CI: a production dependency audit, the verify steps and the build, no key
data/                    planning knowledge as YAML (weights, tasks, levers, questions, functions)
golden/llm/              committed model recordings, one per fixture and prompt
fixtures/                the input texts the recordings were made from
docs/                    accessibility, data handling, deployment, GenAI services, limitations, prompt evolution
docs/REQUIREMENTS.md     what the ids in code comments (FR-24, D18, "architecture 4.5") mean
docs/adr/                decision records 0001 to 0010
scripts/                 data validation, id generation, golden recorder, repo guards, page measurement
src/proxy.ts             nonce CSP, language and damaged-link handling
src/core/                pure decisions
src/schemas/             Zod schemas: model replies, forms, operations, sealed state
src/server/              gateway, prompts, pipelines, sealed state, HTTP guards, rate limit, logging
src/app/, src/components/  routes (en and hi), pages, the two client islands
src/i18n/                English and Hindi text
tests/                   unit, http, golden, security, a11y
```

How to change the planning data or a prompt, and get the change through the checks, is in [`CONTRIBUTING.md`](CONTRIBUTING.md). Why the design is the way it is, with the alternatives that were rejected, is in the [decision records](docs/adr).

## Built with

Claude Code did the engineering, under the author's direction: the author chose the problem, the persona, the scope and the rule that the model reads while code decides, and reviewed the results. Gemini is the model inside the product. Antigravity was not used. Dependencies are pinned exactly in [`package.json`](package.json): Next.js 16.4.2, React 19.3.1, TypeScript 6.0.3, Zod 4.6.7 and `@google/genai` 2.31.0. It is hosted on Google Cloud Run, with Secret Manager for the keys and Cloud Build for the image.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
