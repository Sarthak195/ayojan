# Ayojan

Ayojan (आयोजन, Hindi for organising an event) is a web app for planning celebrations and
events. This repository is a work in progress: the toolchain, security headers, test harness,
CI guards, planning data, schemas and the first pure modules are in place, and the planner's
pages are still being built.

## Run it

Requires Node 24 (see `.nvmrc`).

```sh
npm ci && npm run verify
```

`verify` runs the type check, lint, planning-data validation, tests, the 250-line file cap, the
forbidden-pattern and leaked-key scan, and the repository size check. It needs no API key,
because tests run offline.

To start the app locally, copy `.env.example` to `.env`, fill in `GEMINI_API_KEY`, and run
`npm run dev`. `GET /api/health` reports how many keys are configured without returning them.

## License

Apache-2.0. See `LICENSE`.
