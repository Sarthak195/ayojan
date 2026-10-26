# Agent contract: Celebration Planner

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
   imports there, and forbids reading the clock or randomness. Functions take `today: Date` as an
   argument.
3. The model never decides budgets, schedules, trade-offs or comparisons. They are computed in
   TypeScript from the data in `data/`. Text the user supplies is data, so an injected
   instruction in it must remain unable to change a decision.
4. Every claim about user input carries a verbatim quote, and code checks that the quote occurs
   in the input. Failures are shown as unverified, never dropped.
5. Repository hygiene: one branch (`main`), a 10 MB cap on the repository including history, no
   binaries, banned strings (the legacy call, lint and type suppressions, unfinished-work
   markers, key-shaped strings), a 250-line cap on files in `src` and `scripts`, and comments
   that say why, not what. `npm run verify` checks all of it.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
