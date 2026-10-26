# Celebration Planner (working title)

A web app for planning celebrations and events. This repository is a work in progress: the
toolchain, security headers, test harness and CI guards are in place, and the planner itself
is still being built.

## Run it

Requires Node 24 (see `.nvmrc`).

```sh
npm ci && npm run verify
```

`verify` runs the type check, lint, tests, the 250-line file cap, the forbidden-pattern and
leaked-key scan, and the repository size check. It needs no API key, because tests run offline.

To start the app locally, copy `.env.example` to `.env`, fill in `GEMINI_API_KEY`, and run
`npm run dev`. `GET /api/health` reports how many keys are configured without returning them.

## License

Apache-2.0. See `LICENSE`.
