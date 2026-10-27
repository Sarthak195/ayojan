# Limitations

This page says what Ayojan deliberately does not do, and where it is weaker than it may look.
Each limit is stated as it stands in the code at the time of writing (26 Oct 2026), with the
file that shows it. Security and privacy detail is in [SECURITY.md](../SECURITY.md) and
[DATA_HANDLING.md](DATA_HANDLING.md), the model's role in [GENAI_SERVICES.md](GENAI_SERVICES.md),
accessibility gaps in [ACCESSIBILITY.md](ACCESSIBILITY.md), and what was and was not checked on
the live service in [DEPLOYMENT.md](DEPLOYMENT.md).

## What Ayojan deliberately does not do

### It knows no prices

No vendor price, market rate or "typical cost" appears anywhere in the code or the data. The
only rupee figures in a plan are the ones the user typed (budget, vendor quotes, amounts booked)
and arithmetic on them. The budget split in
[budget-weights.yaml](../data/budget-weights.yaml) is a set of proportions of the user's own
budget, and the file header says so ("proportions of the user's own budget, never prices").
A quote that says tax is extra without giving the rate is shown as "rate not stated", and a
quote that is silent or unclear about tax is treated as tax unsettled
([tax.ts](../src/core/quotes/tax.ts)). No rate is ever filled in, and a vendor row stays
"Unconfirmed until you book".

### The proportions are the author's assumptions

Every weight, guest-scaling share, floor and lever percentage in `data/` carries a `basis` that
reads "Planning assumption chosen by the author", and no row names a survey, report or website
as its source, because none was fetched and checked. The `reviewed` note on the 73 reviewed rows
reads "AI-assisted review at the author's request": it is a review made with an AI assistant,
and no wedding planner, caterer or other person from the trade is recorded as having checked
the proportions. The 15 small-celebration lead-time blocks in [tasks.yaml](../data/tasks.yaml)
were added later and have an empty `reviewed` field: nobody has reviewed them. The pages label the figures the same way ("Planning assumption", "Using the
small-celebration profile: planning assumptions, check them"). The savings shown for the
percentage trade-offs in [levers.yaml](../data/levers.yaml) (for example a simpler decor line
saving 30 percent of the decor amount) are guesses at what a vendor might agree to, and the
pages label them "Planning assumption: about N percent". Two of the seven trade-offs are exact arithmetic
instead: halving the contingency and raising the budget.

### It books and pays for nothing, and sends nothing

Ayojan does not contact a vendor, take a deposit, hold a date or send a message. "Mark done"
with an amount records the user's own statement that something was booked. The messages page
builds a family update and one question list per vendor as text for the user to copy; the
copy button is a small browser script, and without JavaScript the page says to select the text.

### It keeps no accounts and no database

There is no login, session, cookie or stored plan. The plan is the link: the confirmed steps
are compressed, encrypted with AES-256-GCM and placed in the URL path
([seal.ts](../src/server/state/seal.ts)). That has consequences:

- Anyone who holds a link can open that plan and add to it. A link cannot be revoked, and an
  earlier link from the same plan keeps opening, because the server holds nothing that could be
  switched off.
- A lost link is a lost plan. Nobody, including the author, can recover it.
- Changing `STATE_SEAL_KEY` invalidates every link ever issued (there is one key, not a key
  ring; see [DEPLOYMENT.md](DEPLOYMENT.md)).
- Google Cloud's own request log may hold the links (the footer says so).
- "No database" is not "nothing in memory". Each instance keeps a bounded cache of model
  readings, described under the running-service limits below.

### Seven categories, and nothing outside them

A budget is split across venue, catering, decor, photo and video, music, invitations and return
gifts, and contingency ([vocabulary.ts](../src/schemas/readings/vocabulary.ts)). A puja's
pandit fee and samagri, a wedding's guest stay and travel, gifts for the family and similar
costs are not categories of their own and are not tracked. If the user mentions a must-have
or a guest need outside the closed lists, it is shown as "Noted, not planned by this app" and
no number or task is computed from it. The model has no way to add a
category, because the reading schemas are closed lists.

There are two budget profiles, one for weddings and one for birthdays, anniversaries, pujas,
community events and "other". The wedding profile knows five functions (haldi, mehndi,
sangeet, wedding, reception). The task list has 20 tasks and the question list 19 vendor
questions. The small-celebration profile drops five wedding-only tasks (the mandap, the haldi,
the sangeet, the printed cards and the menu tasting) and gives every other task its own shorter lead time and duration. Ayojan knows nothing
about festival or auspicious dates, venue availability or weather: it only knows the date the
user gives.

The small-celebration task list is still close to a wedding's. A five-guest puja at home still
gets a venue booking, a final walkthrough at the venue and a music booking, and saying "ghar pe"
(at home) or "no DJ" changes neither the venue share nor the music task; the words are kept as a
note. Short notice: a celebration a week away (6 or 7 days) is planned with every task At risk
and none Late, because its lead times are latest finishes of one to five days. With 5 days or
fewer the venue and caterer chain shows Late, which is the honest answer at that notice; a Late
task then says what it needs and what to do ("Needs 3 days from today, 2 days left before 4 Nov
2026: start today", or "Was due by 25 Oct 2026: start today" once the date has passed). Because
these are latest finishes, a family planning six weeks out sees On track until about a week
before, and every task reads At risk under two weeks, since the At risk threshold (14 days of
slack) is shared with weddings. The family update names a Late task's date and "start today",
without the day counts the plan page shows.

### It suggests no themes or ideas

Ayojan does not generate decor concepts, themes, menus or other ideas. The reason is in the
design rule: a value from the model counts only if its quote is found in the user's own words
([ADR 0002](adr/0002-grounding-by-verbatim-quote.md)), and an idea is not in the user's text, so
it cannot be quoted and code cannot check it. An idea list would be the one output a family might
act on that nothing verifies. The same reasoning is in
[GENAI_SERVICES.md](GENAI_SERVICES.md#8-considered-and-rejected). What the app does instead is
ask: guest needs, diet and venue limits change the tasks, the levers and the vendor questions,
and anything else the user names is kept as a note and never used in a decision. A user who wants
ideas has to bring them.

### The reader asks instead of guessing

A vague date such as "end of February", a budget range ("5 to 6 lakh"), a budget given per
person, or a guest range are read as unclear: the check page shows the field as a question and
the user answers it ([guardrails.ts](../src/server/prompts/shared/guardrails.ts),
[brief.ts](../src/server/prompts/brief.ts)). The model is told never to work out a year, a
weekday or a date. When a day and month arrive without a year (for example "26/2"), the
program, not the model, takes the next such date after today
([date-answer.ts](../src/core/brief/date-answer.ts)), and the check page shows the resulting
date for the user to confirm; a date that is today or earlier is asked about again. A
value only counts if the quote the model gives for it is found, character for character, in
the text the user wrote; otherwise it is shown as unverified (never silently dropped, never
trusted). The cost is real: a user who has only a rough figure must still type one, and a
correctly read brief can still come back with several questions. A quote longer than 160
characters makes that one field unverified and the rest of the reading continues.

One narrow exception: when the model marks a budget or a guest count as given but returns no
number, code reads it from the quoted words with the same parser as the form ("budget dedh lakh"
becomes Rs 1,50,000), and the quote is still checked against the text
([read-brief.ts](../src/server/pipeline/read-brief.ts)). **Fixed on 27 Oct 2026 (`5f4a508`):**
the guest count used to have no such step, so "do sau log" was asked about; it now fills 200,
while a range or a number outside the guest bounds is still asked. The line "N of M values matched your words" counts only
verified values: a quote that was found but whose number is out of range or not written in it
gets its own badge ("In your words, but needs your answer"), and still counts as not matched.

### Hindi and Hinglish

The interface exists in English and Hindi, and the family-update templates in both. Texts
typed in Hindi, English or a mix are read by the model. The Hindi was written and then reviewed with AI assistance in one pass on 26 Oct 2026;
it is not a professional translation and no native-speaker proofreader is recorded. The
scanner that checks amounts reads digits, the units sau, hazaar, lakh and crore, and a closed
table of Hindi number words: ek to das, the tens bees to nabbe, dedh, dhai, sava, saadhe and
paune ("do lakh", "pachaas hazaar", "dedh sau"; `edbe882`, `3fb00cd`). Sixty is read only as
Devanagari साठ: Latin "saath" is also a spelling of saat (7) and means "with", so "saath lakh" is
asked. Any other number word, such as English "eight" or Hindi "pachpan", is left unread, and a
compound or a range ("do sau pachaas", "do-teen lakh", "do to teen lakh", "pachees-tees hazaar",
"do sau hazaar") is read as several amounts, so the user is asked for the figure. Grounding reads
a quote's numbers from the whole text, so a quote cut from one end of a range is not verified,
and a brief's budget, guest count and venue capacity must be the only amount in their quote.

## The money model is simple on purpose

- **The split is frozen at the brief.** A later change to the budget, the guest count or the
  date never re-splits the money. A budget cut appears as a gap with trade-offs to choose from,
  and only the "Move money" step changes the allocations, within fixed rules: it takes
  from categories marked "save" first, then standard ones, never below half of what they were
  given (contingency never below 5 percent of the budget), and never from an "invest more"
  category or one that is booked, quoted, a must-have, or touched by a chosen trade-off.
- **Nothing is chosen for the family.** Trade-offs are offered with their consequences and
  applied only when the user ticks them.
- **Fixed on 27 Oct 2026 (`7074a9b`, `dde3477`, `9112b0c`): a plan with nothing priced says so.** Until a comparable
  quote or a booking exists, the projected cost is only the user's own split, which adds up to the
  budget, so "Within budget" would be true by construction. The headline now reads "Not priced yet"
  (with "add a quote or a booking to compare"), on the plan page, the revision page and the trade-off
  section. An unclear or over-cap quote does not count as priced, and an overshoot caused by more
  guests or a smaller budget is still shown as over budget.
- **Quotes are compared with each other only.** Quotes in the same category are put on one
  basis using the user's guest count and ordered by total before any tax whose rate is unknown
  ([ranking.ts](../src/core/quotes/ranking.ts)). That order is arithmetic on the user's own
  numbers; Ayojan has no price data to say a quote is fair or a vendor is good.
- **Dates are Indian dates.** Statuses are worked out against today's date in India when a page
  is opened, so a plan link opened a month later shows tasks as later, not as they were.

## Hard limits in the code

A step that would cross one of these is refused with a plain page and the plan is unchanged. A
brief value outside its range becomes a question on the check page.

| Limit                     | Value                                                    | Where                                                                                              |
| ------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Budget                    | Rs 5,000 to Rs 10 crore                                  | [brief.ts](../src/schemas/plan/brief.ts)                                                           |
| Guests                    | 1 to 5,000 (venue capacity up to 10,000)                 | [brief.ts](../src/schemas/plan/brief.ts)                                                           |
| Steps in one plan         | 40                                                       | [op.ts](../src/schemas/plan/op.ts)                                                                 |
| Length of a plan link     | 4,000 characters, and at most 16 KiB of data once opened | [token-codec.ts](../src/server/state/token-codec.ts)                                               |
| Vendor quotes in one plan | 6                                                        | [apply.ts](../src/core/plan/apply.ts)                                                              |
| Delaying a task           | at most 60 days                                          | [task-event.ts](../src/schemas/forms/task-event.ts)                                                |
| One form post             | 32 KiB, 64 fields, 2,000 characters per text field       | [form-body.ts](../src/server/http/form-body.ts), [urlencoded.ts](../src/server/http/urlencoded.ts) |

The link length is the limit most likely to be met, and it is measured and not assumed. A
typical session (a brief, two quotes, two changes, ten bookings, three delays and a pending
change) seals to 2,760 characters in a test fixture that checks the codec; it is a size
fixture, not a real plan. The largest possible content (every text at its limit, in Devanagari)
seals to 6,196 characters, so the 4,000-character cap stops it, and with that content only
about 12 steps fit. Such a plan gets the "this plan's link is full" page; undoing one step or
starting a new plan is the way out. The measurement is
`npx vitest run tests/unit/server/state/token-size.test.ts`.

## The running service

### Model quota is shared, treated as free-tier and assumed

Ayojan is treated as a free-tier Gemini client, and from commit `8ab00a3` (live since revision `ayojan-00003-lx6`) its read pages tell users so. On 26 Oct 2026 the
Cloud Run project had billing enabled but the Gemini API was not enabled in it, so none of the 7
working keys can come from that billed project; the projects the keys do come from were not
inspected. From the first deploy after 27 Oct 2026 (D46) the service runs on one of those keys only, because pooling
free-tier keys from several projects can read as getting around Google's documented usage
limits. No paid key was added: a paid last step on the model ladder was offered and declined,
so none was built. Text a user submits for reading goes to Gemini under
Google's terms, not this project's, and is treated as unpaid use (see
[DATA_HANDLING.md](DATA_HANDLING.md)). The daily allowance is not read from Google: the code
assumes about 20 requests per model per project per day, one project behind the one key, so
about 60 model calls a day in total, and a reset at midnight Pacific time ([exhaustion.ts](../src/server/genai/exhaustion.ts)),
and none of these has been measured. When a model refuses or times out, the app tries the next
model on the ladder, and when all fail it says so, naming the reason, and offers the plain form,
which does everything except the reading. A read can take up to 40 seconds before it gives up.
Latency varies with Google's side: on 26 Oct 2026, a dozen reads from a local production server
with real keys took between 6 and 39 seconds, and one of twelve first tries ran out of time and
fell back to the form with the reason shown. A single read on the deployed service took 5.2
seconds. These are observations, not benchmarks.

To keep some capacity for people typing their own text, the example texts are served from
their recorded readings (labelled as recorded) once a model and key pair is above 80 percent of
its assumed allowance. That reserve protects only the examples. Text a user types can spend the
whole allowance.

With one key (D46), a rejected key (401/403) turns AI reading off for the whole service for six
hours, or until a new instance starts, and the page names quota as the reason; a 429 on a model
sends every read to the next model for an hour.

### Rate limits are per instance and advisory

The limits live in each instance's memory ([rate-limit.ts](../src/server/ratelimit/rate-limit.ts)):

| Class          | Applies to                                                       | Limit per client                                        |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| Model          | reading a brief, quote or change, and drafting the family update | a burst of 3, then 6 a minute, and 20 a day             |
| Step           | every other POST                                                 | 60 a minute                                             |
| Whole instance | model actions                                                    | 60 a day (the whole assumed allowance, on one instance) |

What that does not give you:

- **A brief overlap during a deploy.** From the next deploy (D46) Cloud Run runs one instance (the serving revision still allows three), but during a deploy an
  old and a new revision can overlap briefly, each counting alone.
- **A daily budget that lasts as long as an instance.** With no minimum instance, a cold start
  resets the counters.
- **A weak client identity.** The key is a salted hash of the address Google's front end
  appends to `X-Forwarded-For`. On the live service, 90 parallel posts, each carrying a
  different made-up `X-Forwarded-For`, still got 27 refusals (429), so the caller does not
  choose it. But a caller with many real addresses has many allowances, and when more than
  10,000 clients are tracked the oldest are forgotten.
- **No limit on page views.** Only POSTs are limited. Each plan page decrypts its link, which
  is bounded by the 4,000-character cap.
- **The real ceiling** is the one instance's 60 model actions a day, and then the Gemini
  quota itself.

### The reading cache is per instance

Each instance remembers recent readings, keyed by a hash of the prompt and the text, so the
same text is not read twice: at most 200 entries and 2 MiB, for at most 24 hours
([reading-cache.ts](../src/server/genai/reading-cache.ts)). A reading holds the quotes from the
user's text, so this is a place where text lives in memory until it expires or the instance
stops. It is never written to disk. Two consequences: the same text sent to a different instance costs a fresh
call, and an AI-drafted family update lives only in the cache of
the instance that made it, so after a reload on a different instance the page shows the plain
template again with the "Write it with AI" button.

### Other service limits

- **The health report is public.** `/api/health` shows status, the data counts, the reading
  cache entry count and this instance's count of model actions today. The key count and the
  per-key quota counters appear only with `HEALTH_DETAIL=1`, which is off by default. It holds
  no key and no text.
- **Every page loads the React and Next runtime.** The plan works with JavaScript switched off,
  because it is plain forms and redirects, but a page still carries about 132 KiB of gzip
  JavaScript, and only two small scripts are Ayojan's own (the running total on the trade-off
  page and the copy button). The server sends gzip, not brotli. Measured with
  [measure-pages.mjs](../scripts/measure-pages.mjs) on 26 Oct 2026.
- **The model can change under the code.** The app records which model answered
  (`interaction.model`), names it on the check page, and does not assume it is the one it asked for. The recorded readings in
  `golden/llm/` are from one date, and tests run on them offline, so a later change in the
  model's behaviour would show up only on the live service.
- **Accessibility is tool-checked, not certified.** No conformance level is claimed; see
  [ACCESSIBILITY.md](ACCESSIBILITY.md) for what was checked and what tools cannot show.
- **Two languages only**, English and Hindi, and one region (`asia-south1`).
