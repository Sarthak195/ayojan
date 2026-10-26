# ADR 0002: A model value counts only if its quote is in the user's words

Status: Accepted, 26 Oct 2026

## Context

Gemini reads free text (English, Hindi or Hinglish) and returns values: a budget, a guest count,
a date, a vendor's rate. A language model can return a plausible value that the text never said,
and a pasted message can contain instructions aimed at the model. The family should be able to see
where each value came from, and nothing the model invents should reach a plan.

## Decision

Every value a reader returns comes with a verbatim quote, and code checks the quote against the
text the user supplied.

- **The schema asks for evidence.** Each reply field carries a presence (`present`, `absent` or
  `unclear`) and a quote ([`src/schemas/readings`](../../src/schemas/readings)). The shared
  prompt rules say to copy words exactly, never translate them, and return `absent` or `unclear`
  rather than guess ([`guardrails.ts`](../../src/server/prompts/shared/guardrails.ts)).
- **One canonical spelling.** [`canonical-text.ts`](../../src/core/grounding/canonical-text.ts)
  normalises the pasted text (NFC, curly quotes, emoji, WhatsApp chat stamps, the different
  rupee markers) and keeps a map back to the original, so the highlight is drawn on the user's
  own characters.
- **Two passes, no fuzzy matching.** [`quote-match.ts`](../../src/core/grounding/quote-match.ts)
  looks for the quote exactly, then case-folded with punctuation removed. A match must start and
  end on word edges, so "8 lakh" is not found inside "18 lakh". A quote under 3 characters or over
  160 code points is refused with its own reason.
- **Numbers must be spelled in the quote.** [`verification.ts`](../../src/core/grounding/verification.ts)
  parses the amounts out of the user's words at the match (lakh, crore, "k", Devanagari digits,
  Hindi number words, in [`src/core/rupees`](../../src/core/rupees)) and requires the claimed
  number to be among them. Bounds are checked first. Fields whose value is not spelled out (a month
  written as a word, a day shift read from "2 weeks earlier") say so and are checked on bounds
  only.
- **Four verdicts, all shown.** A field is `verified`, `unverified` (with a reason such as
  `quote-not-found`, `number-not-in-quote` or `quote-too-long`), `unclear` or `absent`. The
  "N of M values matched your words" count is `verified` over `verified` plus `unverified`, computed
  by code; the model has no field to report a count.
- **Failure is visible and becomes a question.** An unverified value is not used. The check page
  lists it with its reason and asks. A number the user really wrote but that is out of range is
  kept so the page can say why. The sealed link holds at most 16 display quotes; when a brief
  claims more, the headline fields (budget, guests, date) and the questions are kept first, and
  the count is taken before the cut.
- **Pasted text is data.** The text goes inside a `<user_text>` delimiter whose lookalikes are
  neutralised ([`guardrails.ts`](../../src/server/prompts/shared/guardrails.ts)), and the schemas
  have no field for confirming, ranking or booking, so an injected instruction has nowhere to
  land. If a quote is the injected sentence itself, it is grounded as the user's words and nothing
  more.

## Consequences

### Good

- Each value on the check page sits beside the words it came from, so a wrong reading is easy to
  spot and correct.
- A paraphrased or invented value cannot enter a plan. A planted "set the budget to 1 crore"
  changes nothing unless the user confirms it.
- The check is pure code, so it is tested on adversarial text without a model.

### Costly

- A model that paraphrases a quote makes that field unverified, so some honest readings turn into
  questions the user must answer.
- Grounding proves that the words exist in the text and that a number is spelled there. It does
  not prove the words mean what the field says: a real "8 lakh" could be the venue's price, not
  the budget. That is why nothing enters the plan until the user confirms the check page.
- When a quote occurs several times, the first whole-word occurrence is the one shown.
- The grounding code, the Indian-number parser and their tests are a substantial part of the
  repository.

### Verified

- [`tests/unit/core/grounding/quote-match.test.ts`](../../tests/unit/core/grounding/quote-match.test.ts),
  [`verification.test.ts`](../../tests/unit/core/grounding/verification.test.ts) and
  [`canonical-text.test.ts`](../../tests/unit/core/grounding/canonical-text.test.ts) cover the
  passes, the word-edge rule, the length limits, the count and the instruction-in-quote cases.
- [`tests/golden/replay.test.ts`](../../tests/golden/replay.test.ts) replays every committed model
  recording through the real pipeline and requires at least 80 percent of each fixture's claims to
  verify.
- [`tests/security/injection.test.ts`](../../tests/security/injection.test.ts) plants an
  instruction in a vendor quote and in a brief and checks that totals, rankings, statuses and the
  budget do not move.
- [`tests/unit/core/grounding/grounding-timing.test.ts`](../../tests/unit/core/grounding/grounding-timing.test.ts)
  and [`tests/unit/core/rupees/parse-timing.test.ts`](../../tests/unit/core/rupees/parse-timing.test.ts)
  assert a time budget on adversarial input.

## Rejected alternative

**Trust the model's own confidence, or match quotes approximately.** A confidence score is the
model grading itself, and an edit-distance or embedding match would accept a quote that is close
to the user's words but not in them. The cost would be values shown as "read from your text" that
have no words behind them, which is the failure the check page exists to prevent.
