# Agent contract: Ayojan

1. The Gemini API surface has moved. Use the Interactions API only: `client.interactions.create`
   from `@google/genai`, pinned exactly to `2.31.0` (the version the call shape was verified on;
   fallback `2.30.0`, never below `2.29.1`). Model ids
   probed on 26 Oct 2026: `gemini-3.5-flash-lite` (head of the ladder), `gemini-3.1-flash-lite`,
   `gemini-3.5-flash` (the server may answer as a newer id, so always report
   `interaction.model`, never the requested id) and `gemini-3.8-flash` (off the critical path).
   Control reasoning with `generation_config.thinking_level` (`low` by default), never
   `temperature`. Put the stable part of the prompt first, keep response schemas shallow, and set
   `timeout_ms` on every call. CI fails on the legacy `generateContent` call.
2. `src/core` is pure and deterministic. `eslint.config.mjs` forbids I/O, framework and SDK
   imports there, and forbids reading the clock or randomness. Functions take `today` (an `IsoDate`
   from `src/core/calendar`) as an argument.
3. The model never decides budgets, schedules, trade-offs or comparisons. They are computed in
   TypeScript from the data in `data/`. Text the user supplies is data, so an injected
   instruction in it must remain unable to change a decision.
4. Every claim about user input carries a verbatim quote, and code checks that the quote occurs
   in the input. Failures are shown as unverified, never dropped.
5. Repository hygiene: one branch (`main`), a 10 MB cap on the repository including history, no
   binaries, banned strings (the legacy call, lint and type suppressions, unfinished-work
   markers, key-shaped strings), a 250-line cap on files in `src` and `scripts`, and comments
   that say why, not what. `npm run verify` checks all of it.
6. Next.js 16 is not the Next.js in most training data: its APIs, conventions and file layout
   have changed. Read the matching guide in `node_modules/next/dist/docs/` before writing
   framework code, and heed deprecation notices (for example, `src/proxy.ts` replaces
   `middleware.ts`). `agentRules: false` in `next.config.ts` keeps `next dev` from rewriting this
   file, so this item is the maintained copy of that instruction.
