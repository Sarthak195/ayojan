# ADR 0004: An unknown is a third value, and it becomes a question

Status: Accepted, 26 Oct 2026

## Context

Real input is incomplete. A brief says "Feb end mein" instead of a date. A caterer's quote says
"plus GST" and gives no rate, or gives no minimum number of plates. A form field is left blank.
If the app turns each of these into 0, an average or a default, the plan looks complete while
resting on something nobody said: a missing price becomes a free vendor that wins every
comparison, and a guessed date moves a whole schedule.

## Decision

"I do not know" is a value of its own, carried through the types, and it ends as a visible
question with no default.

- **Three-valued readings.** A reading's field is `present`, `absent` or `unclear`
  ([`vocabulary.ts`](../../src/schemas/readings/vocabulary.ts)). Priorities, quote basis, tax
  treatment, category and occasion each have an `unclear` value too, and the tax type separates
  `included`, `extraWithRate`, `extraRateUnstated`, `unclear` and `absent`. A function the brief does
  not mention is `unsure`, never `no`.
- **Questions, not defaults.** The brief resolver asks about a missing, unreadable, out-of-range or
  past value ([`questions.ts`](../../src/core/brief/questions.ts)). A question carries the field, a
  reason and what the person gave. The input it renders starts empty, and a wrong value is shown in
  the reason text instead of being pre-filled. A blank form field is a question, never a zero.
  The venue capacity may stay empty.
- **Vague input is not resolved by guessing.** A vague date such as "Feb end mein" is `unclear`; a day and month with no year are resolved by code against today, never by the model, and a date that has passed becomes a question.
  Number words outside the closed table (English "eight", Hindi "pachaas") are left unread
  ([`number-words.ts`](../../src/core/rupees/number-words.ts)). A change that moves a budget in a
  direction only asks "By how much?", and a day shift that disagrees with a written date asks
  "Which date?".
- **A total is only as known as its inputs.** In
  [`comparable-total.ts`](../../src/core/quotes/comparable-total.ts) a rate of zero counts as a
  missing rate, a per-day quote has an unclear total, a lump sum above its guest cap is "cap
  exceeded" and is never scaled, and a tax that is unstated or unclear leaves the total marked as
  not final ([`tax.ts`](../../src/core/quotes/tax.ts)). Silence about GST is not "included". The
  comparison shows every quote as "Unconfirmed until you book".
- **Each gap names who can close it.** What is missing from a quote becomes a question to ask
  that vendor, from [`vendor-questions.yaml`](../../data/vendor-questions.yaml), written into
  the template messages.

## Consequences

### Good

- No figure on screen rests on an invented zero or a silent default.
- The user sees why the app is asking and which words it read, in their own language.
- The same rule covers all three readers and both the AI path and the form path, because both end
  in one resolver ([`confirm-brief.ts`](../../src/core/brief/confirm-brief.ts)).

### Costly

- More questions: a vague brief produces a check page with several open fields before a plan
  exists, which is slower than guessing.
- The closed number-word table means "two lakh" in English words is asked rather than read.
- Totals that carry an unstated tax have to be explained in words ("plus GST, rate not stated")
  rather than shown as one clean number.
- Every new field needs a decision about what its unknown looks like, which adds types and tests.

### Verified

- [`tests/unit/core/brief/questions.test.ts`](../../tests/unit/core/brief/questions.test.ts)
  covers the reasons, that nothing is pre-filled, and that an unmentioned capacity can stay empty.
- [`tests/unit/core/quotes/comparable-total.test.ts`](../../tests/unit/core/quotes/comparable-total.test.ts)
  covers missing rates, minimums, caps, per-day quotes and unsettled tax.
- [`tests/unit/core/grounding/verification.test.ts`](../../tests/unit/core/grounding/verification.test.ts)
  covers `unclear` and `absent` values passing through with their words kept.
- [`tests/unit/core/rupees/parse.test.ts`](../../tests/unit/core/rupees/parse.test.ts) covers the
  English number words that stay unread.
- [`tests/golden/replay.test.ts`](../../tests/golden/replay.test.ts) replays a Hinglish brief
  whose vague date is `unclear` and whose unmentioned functions are `unsure`.

## Rejected alternative

**Fill unknowns with a default (zero, a typical value, "standard") and flag them in small print.**
It is fewer screens, but the plan would be wrong in a way that looks right: the cheapest caterer
would be the one that left out its price, and a guessed date would shift every deadline. The
flag is what people skip, so the default is what would be acted on.
