# Data handling

> We keep no database. Your plan is encrypted inside the link; Google Cloud request logs may hold the link.

That sentence is the summary. The rest of this page says what it means: where your words go,
what the link holds, what is logged, how long things live, and what you can and cannot delete.
The defences around all of this are in [SECURITY.md](../SECURITY.md).

## What the app stores

Nothing that identifies you or your plan is kept on the server between requests.

- **No database, account, session or cookie.** The plan travels in the link as a sealed token
  (AES-256-GCM, built in `src/server/state/seal.ts` and `src/server/state/token-codec.ts`).
  Every step is a form post that answers with a new link.
- **In instance memory only**, and lost when the instance restarts or scales to zero:
  - a cache of recent model replies (see below);
  - rate-limit counters, keyed by a keyed hash of the caller's address, never the address
    (`src/server/ratelimit/client-key.ts`);
  - counts of model calls per model and key index (`src/server/genai/exhaustion.ts`). The public
    `/api/health` shows only the day's total of model actions; the per-key and per-model counts
    are returned only when the server runs with `HEALTH_DETAIL=1`, which is off by default.

### What is inside a link

The link holds the inputs and confirmed steps of the plan, never the computed figures:

- the occasion, budget, guest count, event date and venue capacity;
- which functions are planned, the budget priorities, and must-haves, guest needs, diet and
  venue limits, all chosen from closed lists;
- up to six short notes, up to three "source" fragments for a change, and, while a reading
  waits for your confirmation, up to sixteen checked values with the words they came from. Each
  of these is a verbatim fragment of at most 80 bytes of your text (`src/schemas/plan/short-text.ts`);
- tasks marked done or delayed, with dates, and any amount you entered for a booking;
- each vendor quote as structured fields only: category, price basis, rate, minimum guests, tax
  treatment, advance percentage, and short labels (at most 40 characters) for extras and
  inclusions. The vendor is stored as "Caterer A", never by name, and the pasted message is
  never stored (`src/schemas/plan/quote-record.ts`);
- the lever ids you applied, and which model answered each reading.

The link does not hold the full text you typed or pasted. The plan's own schema is
`src/schemas/plan/state-token.ts`.

Encryption protects the link from anyone who only sees it in a log, a chat preview or a
browser history entry. It does not make the link private from whoever holds it: the app opens
any valid link without asking who is asking, so **anyone with the link can read and continue
the plan**. The service itself holds the key (`STATE_SEAL_KEY`) and can open any link it
sealed. Changing that key makes every existing link stop working.

## What is sent to Gemini

Gemini is called only for four things, and only when you press the matching button
(`src/server/genai/gateway.ts`, `src/server/genai/interactions.ts`).

| Action                           | What is sent                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read my brief                    | The text you typed or pasted, between delimiters, plus the fixed rules and response schema in `src/server/prompts/`                                                                                                                                                                                                                                                                                                   |
| Read a vendor message            | The message you pasted, in the same way                                                                                                                                                                                                                                                                                                                                                                               |
| Read a change                    | The change message you typed, in the same way. The current plan is not sent with it                                                                                                                                                                                                                                                                                                                                   |
| Write it with AI (family update) | A JSON summary of the confirmed plan's facts, and the requested language. The fields are listed in `src/core/messages/fact-types.ts`: occasion, budget, guests and event date now and before the latest change, the projected total, applied levers with their labels, at-risk tasks, vendor labels such as "Caterer A", question ids, unclear quote fields, diet and venue limits. There is no free-text field in it |

Not sent: the sealed link, the whole plan, your address, any key other than the API key, or
anything from a browser other than what you submitted in that form. The example texts are sent
like any other text; once a model's assumed daily allowance is 80 percent used they are
answered from a recording kept in `golden/llm/` instead. The form twin, every page load and
every other step make no Gemini call.

The request sets no sampling options and sets the SDK's `store` option to `false` (which the
SDK describes as whether to store the request and response for later retrieval), so the
Interactions API keeps no copy for later retrieval; a probe on 27 Oct 2026 with `store: false`
got no interaction id back. Ayojan never chains requests and never retrieves one afterwards.
This does not change how Google may use content under the terms of your key's tier: that is
governed by Google's terms, summarised next, not by anything Ayojan chooses.

### Free-tier disclosure

Ayojan is treated as a free-tier Gemini client, and tells its users so. As checked on 26 Oct 2026,
the Cloud Run project has billing enabled, but the Gemini API (`generativelanguage.googleapis.com`)
is not enabled in it, so none of the 7 working Gemini keys can come from that billed project. The
projects the keys do come from were not inspected, so this page does not claim that each key was
verified to be on the free tier. From the first deploy after 27 Oct 2026 (D46) the service runs on one key, and that
key is one of those seven, so the check of 26 Oct still holds for it: it cannot come from the
billed project. No paid key was added: a paid fallback key was offered and declined. The UI carries the notice since commit `8ab00a3` (live since revision `ayojan-00003-lx6`): under
every read button (the start page brief and its examples, the vendor quote box and the plan change box) it says
"Gemini's free tier may use what you send to improve Google's products, so leave out names and
phone numbers." The Hindi interface has the same sentence. It sits in the same hint as "Reading can
take up to 40 seconds.", which the read button references through `aria-describedby`.

The Gemini API Additional Terms
(<https://ai.google.dev/gemini-api/terms>) treat free ("unpaid") and billed ("paid") use
differently. This is a paraphrase of what the terms said when they were read on 26 Oct 2026, not a
quotation, and the page itself is the authority and can change:

- For unpaid use, Google may use the content you submit and the responses to provide, improve
  and develop its products and machine learning technologies, and human reviewers may read and
  annotate API inputs and outputs. The terms say Google disconnects that data from the account,
  API key and cloud project before reviewers see it, and they ask people not to submit
  sensitive, confidential or personal information to unpaid services.
- For paid use, the terms say Google does not use prompts or responses to improve its products,
  and that it logs them for a limited period only to detect and prevent violations of its
  prohibited use policy.
- The terms apply different rules in the European Economic Area, Switzerland and the United
  Kingdom, where the paid-use data terms apply to these services as well.

What this means for you: **do not paste phone numbers, addresses, or the names of private
people into the brief, a vendor message or a change.** The plan does not need them. A budget, a
guest count, a date and the vendor's rate are enough. Names and numbers you type do go to
Gemini under the terms above.

Ayojan itself keeps none of this, and the rest of the app works without the model: the form
twin builds the same plan with no Gemini call.

## What is logged

The app writes one JSON line per event to standard output, which Cloud Run sends to Cloud
Logging. The logger (`src/server/observability/logger.ts`) accepts only a fixed list of fields
and checks each one's shape; a field that is not on the list, or does not fit its shape, is
dropped and counted, never written.

Fields the logger accepts: the route template (such as `/[lang]/read/[kind]`, never the real
path), HTTP status, duration in milliseconds, the kind of step, the reading source (such as ai,
ai-cached, example or form), the prompt id, a short reason code, the model that answered, the key index,
the attempt number, whether the cache hit, counts of verified and claimed values, the token's
length (not the token), byte and item counts, a retry delay, a keyed hash of the client, and
the class name of an error. The app's own log calls use fewer: the route, status and duration of
each step, the prompt id, reading source, reason code and verified and claimed counts of a
reading, and the class name of an error.

**Never written:** the text you typed or pasted, quotes from it, rupee amounts, plan links or
tokens, raw IP addresses, API keys, the seal key, or error messages (they can quote input). The
client hash is keyed with a random value made once per process, so an address cannot be
recovered from it and it does not match across restarts or instances. A test feeds the logger
phrases from a sample brief and checks they never reach a log line
(`tests/unit/server/observability/logger-privacy.test.ts`).

### What Google Cloud logs on its own

Cloud Run writes its own request log for the service, outside this code. It records each
request's URL, and **the plan link is part of the URL path**, so the link can appear there along
with the metadata Google chooses to record for a request. Request bodies are not part of that
log, so the text you submit is not in it. Next.js can also print its own message if a page
throws while rendering; that output is not covered by the allowlist above.

On 26 Oct 2026 it was checked that the project's default log bucket keeps entries for 30 days
(`gcloud logging buckets describe _Default --location=global`) and that its default sink has
no exclusion filter for request logs (`gcloud logging sinks describe _Default`).

## How long things live

| Item                                    | Lives for                                                                                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A plan link                             | As long as someone has the link and the seal key has not changed. There is no expiry. It stops working if the key changes, and a link that no longer opens against the planning data or the link format shows a damaged-link or older-version page                       |
| Cached model replies in instance memory | At most 24 hours, at most 200 entries and 2 MiB, and gone when the instance restarts (`src/server/genai/reading-cache.ts`). A reply holds the values and quote fragments the model returned, keyed by a hash of the prompt and your text (the text itself is not stored) |
| Rate-limit and call counters            | Minutes to a day, in instance memory; up to 10,000 clients tracked                                                                                                                                                                                                       |
| Application log lines                   | 30 days in the project's default log bucket (checked as above)                                                                                                                                                                                                           |
| Cloud Run request logs                  | The same bucket, so 30 days, as checked above                                                                                                                                                                                                                            |
| What Google keeps for a Gemini request  | Set by Google's terms for your key's tier, summarised above; Ayojan has no control over it                                                                                                                                                                               |
| The link in your browser, chat or email | Until you delete it there                                                                                                                                                                                                                                                |

## Deleting your data

There is nothing in Ayojan to delete: no account, no database row and no stored copy of your
plan. To stop a plan being read, **stop sharing the link** and remove it from the places you
put it (chat threads, email, browser history, bookmarks). Anyone who already has it can still
open the plan until the service's seal key is changed, which is not something a single user
can ask for in the app.

Two copies are outside your reach: Cloud Run request logs may hold the link for the 30 days
above, and Google handles anything sent to Gemini under its terms. If you pasted something you
should not have, the plan link does not contain the pasted text, but start a new plan and do
not reuse the old link.

To report a data problem, see "Reporting a vulnerability" in [SECURITY.md](../SECURITY.md).
