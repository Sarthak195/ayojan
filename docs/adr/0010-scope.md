# ADR 0010: Scope: what Ayojan leaves out, which Google services it uses, and the one generated text

Status: Accepted, 26 Oct 2026

## Context

An event planner can grow without limit: vendor directories, price guides, guest lists, bookings,
payments, theme ideas. Each addition brings data that has to be right, a place to store personal
information, or a model output a family might act on. The app's rule is that Gemini reads and code
decides, so the scope has to be drawn where that rule holds, and the Google services it uses should
be only the ones it needs.

## Decision

### Left out on purpose

- **Market or typical prices.** No rupee figure comes from the data files or the model
  ([ADR 0003](0003-planning-knowledge-as-data.md)). A price in a plan is the user's budget, a share
  of it, or a number from a quote or booking the user supplied.
- **Vendor names, a directory or a marketplace, and availability.** A vendor is "Caterer A", from
  the user's own quote. Every comparison column reads "Unconfirmed until you book", and the quote
  schema has no field for confirmation, availability or ranking.
- **Idea or theme generation.** The app serves the occasion by asking: guest ages, access needs,
  diet and venue limits shape tasks and vendor questions. Anything else the family insists on is
  kept as their own words under "Noted, not planned by this app" and never changes a decision.
- **Guest lists, payments, accounts and file uploads.** There is nothing to store
  ([ADR 0005](0005-sealed-state-in-the-link.md)), so there is no login, and the pages have no
  file input.
- **Occasions are a picker, not separate products.** A wedding uses the wedding profile and the
  birthday, anniversary, puja, community event and other options use the small-celebration profile,
  with the same code.

### Google services used

| Service                                | Used for                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini Developer API (`@google/genai`) | The four prompts in [`docs/PROMPT_EVOLUTION.md`](../PROMPT_EVOLUTION.md), through the Interactions API ([ADR 0007](0007-gemini-interactions-api-and-ladder.md)) |
| Cloud Run                              | Runs the standalone Next.js server from the [`Dockerfile`](../../Dockerfile)                                                                                    |
| Secret Manager                         | Holds `GEMINI_API_KEY` and `STATE_SEAL_KEY`, mounted into the service                                                                                           |
| Cloud Build                            | Builds the image from source when the service is deployed                                                                                                       |

### Google services rejected

| Service                   | Why not                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Vertex AI                 | Needs billing and a service-account credential; the app needs one API key read from the environment                          |
| Firestore or any database | There is nothing to store: the plan is the sealed link                                                                       |
| Firebase Auth             | There are no accounts and no session to protect                                                                              |
| Search grounding          | The app never looks up a price; nothing in a plan comes from the web                                                         |
| Cloud Translation         | One prompt reads English, Hindi and Hinglish and returns quotes in the original script; interface text is data in `src/i18n` |
| Preview models            | The `LadderModel` type names three models and no preview, so one cannot be requested by mistake                              |

### The one generated text: the family update

Three of the four prompts read; one writes. On request ("Write it with AI" on the messages page), the
model drafts a short WhatsApp update for the family in English or Hindi, as at most six lines.

- **Code supplies the facts.** The prompt receives only the facts that
  [`message-facts.ts`](../../src/core/messages/message-facts.ts) builds from the plan: figures,
  dates, question ids and fixed labels. It is told to use only numbers present in them.
- **Code checks the draft.** [`draft-check.ts`](../../src/core/messages/draft-check.ts) finds every
  number in every line and rejects the draft if any is not among the facts or cannot be read exactly,
  or if it leaves out a question the vendors must answer again. A rejected draft is never shown: the
  template is, with the reason. An accepted draft is labelled "AI draft, numbers checked against
  your plan: n of n".
- **Templates are the default and the fallback.** The template family update and every vendor
  message are built from question ids by code, not written by the model.
- **Where it is kept.** The checked draft or its rejection lives in the reading cache under a hash
  of the facts, not in the link ([ADR 0005](0005-sealed-state-in-the-link.md)), so the step
  redirects without resealing.

## Consequences

### Good

- Each omission removes a source of unverifiable data or stored personal information.
- Four Google services and one SDK are enough to deploy, secure and run the app, and each has a
  stated reason to be there.
- The only text a model writes for a person is checked by code before it is shown, and a failed
  check costs the user nothing but the template.

### Costly

- The app will not suggest a vendor, a venue or a theme, and it cannot say what anything usually
  costs. A user who wants that must look elsewhere.
- Guests, vendor contacts and payments stay in whatever the family already uses.
- The number check catches a wrong or invented number, not a clumsy sentence or a wrong tone. The
  check demands that each question be mentioned with a fixed topic word, which can make a draft
  read stiffly.
- A draft spends a model call and some of the shared allowance for a message the template could
  also have supplied.

### Verified

- [`tests/unit/core/messages/draft-check.test.ts`](../../tests/unit/core/messages/draft-check.test.ts)
  and [`tests/unit/server/pipeline/draft-family-update.test.ts`](../../tests/unit/server/pipeline/draft-family-update.test.ts)
  cover rejected numbers, missing questions, empty drafts, caching and the template fallback.
- [`tests/golden/replay.test.ts`](../../tests/golden/replay.test.ts) replays the recorded Hindi draft
  through the real draft check and asserts it is accepted.
- [`tests/unit/core/messages/templates.test.ts`](../../tests/unit/core/messages/templates.test.ts)
  covers the templates.
- [`tests/security/injection.test.ts`](../../tests/security/injection.test.ts) shows a planted quote
  gaining no confirmation, ranking or booking; [`tests/unit/data.test.ts`](../../tests/unit/data.test.ts)
  shows the data files holding no rupee amounts.

## Rejected alternative

**Let the model write more: the whole plan summary, vendor messages, vendor recommendations or
theme ideas.** It would make the app feel more capable. The cost is output that carries numbers or
judgments no code has checked, such as a "best" caterer or a "typical" price, in a product whose
rule is that the model never decides. A second generation call, such as a paragraph on what a
change means for the family, was also left out: it adds quota use and reading time without adding
a decision.
