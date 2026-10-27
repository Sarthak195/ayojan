# Deployment

This page is a record of what was done to put Ayojan on Google Cloud Run, not a plan. Every
setting below was read back from the running service with `gcloud run services describe` on
26 Oct 2026 and again on 28 Oct 2026 for the table below, and anything that was not checked is in the last section. The live address is
<https://ayojan-626015685685.asia-south1.run.app>. The service's other generated address,
`https://ayojan-vdsl6cg5fa-el.a.run.app`, also answered `/api/health` with 200 on the same day.

## What is deployed

| Fact (as read on 28 Oct 2026) | Value                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service and region            | `ayojan`, `asia-south1` (Mumbai)                                                                                                                                                                                                                                                                                                                                                      |
| Revision serving traffic      | `ayojan-00009-v7q` at 100 percent of traffic; `ayojan-00008-tes`, the `3ff942e` image without the Gemini secret, carries the tag `nokey` at 0 percent; the earlier revisions, `ayojan-00001-jxf` to `ayojan-00008-mr7`, are kept for rollback                                                                                                                                         |
| Source of that revision       | commit `1abc9f6` on `main`                                                                                                                                                                                                                                                                                                                                                            |
| Request timeout               | 60 seconds                                                                                                                                                                                                                                                                                                                                                                            |
| Instances                     | no minimum (the `minScale` annotation is absent, so the default of 0 applies), maximum 1 (since `ayojan-00006-nhx`; revisions up to `ayojan-00005-zaz` allowed 3)                                                                                                                                                                                                                     |
| Per instance                  | 1 CPU, 512Mi memory, concurrency 80 (the Cloud Run default; no flag sets it)                                                                                                                                                                                                                                                                                                          |
| Startup CPU boost             | `startup-cpu-boost: true` appears in the revision's annotations; the deploy command did not pass a flag for it                                                                                                                                                                                                                                                                        |
| Port                          | container listens on 8080                                                                                                                                                                                                                                                                                                                                                             |
| Access                        | public (`allUsers` holds `roles/run.invoker`), because the deploy used `--allow-unauthenticated`                                                                                                                                                                                                                                                                                      |
| Secrets                       | `GEMINI_API_KEY` from Secret Manager secret `gemini-api-key`, and `STATE_SEAL_KEY` from `state-seal-key`, both at version `latest` and both mounted as environment variables, with no plain-text value on the service. `latest` of `gemini-api-key` is version 3, which holds one key (D46, read since `ayojan-00008-mr7`); versions 1 and 2, which held the seven-key pool, are kept |
| Image                         | built by Cloud Build from the [Dockerfile](../Dockerfile), stored in the `cloud-run-source-deploy` Artifact Registry repository in `asia-south1`                                                                                                                                                                                                                                      |

The second revision was built from `a9184fe` on 26 Oct 2026 at about 20:15 IST. Over the first
it adds Hindi wording, the table caption fix, the small-celebration lead times, the slack wording,
the `usb=()` entry in the Permissions-Policy, the answering model on the check page, grouped digits
in amount fields and the page icon; `git log --oneline f694edb..a9184fe` lists every commit. The
image leaves out Markdown files and `docs/` (see `.dockerignore`), so a later commit that changes
only those needs no deploy.

The third revision was built from `eb37d0d` on 26 Oct 2026 at about 23:20 IST. It adds the privacy
sentence under every read button, in English and Hindi (`git log --oneline a9184fe..eb37d0d`). The fourth
was built from `e632246` on 27 Oct 2026 at about 21:58 IST: requests set `store: false`, and a plan
says "Not priced yet" until a comparable quote or a booking exists (`git log --oneline eb37d0d..e632246`).
It still allowed 3 instances and read the seven-key secret.

The later revisions, all on 27 and 28 Oct 2026:

- `ayojan-00005-zaz`, about 22:05 IST: the `e632246` image without the Gemini secret, tagged
  `nokey` with no traffic, so the form fallback can be shown on the real image.
- `ayojan-00006-nhx`, about 23:44 IST, from `3ff942e`: the first with a maximum of 1 instance,
  still on the seven-key secret (version 2).
- `ayojan-00008-tes`, about 23:45 IST: the `3ff942e` image without the Gemini secret, tagged
  `nokey` at 0 percent. It is the keyless twin today; the tag left `ayojan-00005-zaz`.
- `ayojan-00008-mr7`, about 23:52 IST: the same `3ff942e` image with version 3 of
  `gemini-api-key`, which holds one of the seven keys (D46). Versions 1 and 2 are kept.
- `ayojan-00009-v7q`, 28 Oct 2026 at about 00:10 IST, from `1abc9f6`: the ladder's second rung
  waits 18 s instead of 12 s, and each model call writes one log line (see
  [DATA_HANDLING.md](DATA_HANDLING.md)). Maximum 1 instance, one key, 100 percent of traffic.

A `--no-traffic` deploy pins traffic to the revision serving at that moment, by name. So after
the `nokey` deploy of `ayojan-00005-zaz`, the next plain deploy, `ayojan-00006-nhx`, was built and
got 0 percent; it took traffic only after
`gcloud run services update-traffic ayojan --region asia-south1 --to-revisions ayojan-00006-nhx=100`.
Every main deploy since has been routed the same way, by name.

## The container image

The [Dockerfile](../Dockerfile) has three stages on `node:24-alpine`, matching `.nvmrc`.

| Stage     | What it does                                                                                                                                                    | Why                                                                                                                                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deps`    | Copies only `package.json` and `package-lock.json` and runs `npm ci`                                                                                            | Editing source reuses the cached install layer. Dev dependencies stay because the build needs TypeScript and Tailwind; they never reach the final image.                                                                                                   |
| `builder` | Copies the source, runs `npm run build`, makes an empty `public/`                                                                                               | `next.config.ts` sets `output: 'standalone'`, so the build emits a self-contained server. No key is passed and no `ARG` carries one, because a build argument survives in `docker history`; keys are read when a request arrives, so the build needs none. |
| `runner`  | Copies `.next/standalone`, `.next/static`, `public/`, and by name `data/`, `fixtures/` and `golden/llm/`; runs `node server.js` as the unprivileged `node` user | The standalone tracer follows imports but not files read through `process.cwd()`, so the planning data, the example texts and their recorded readings are copied explicitly. The rest of `golden/`, `tests/` and `scripts/` never reach the image.         |

The runner sets `NODE_ENV=production`, `PORT=8080`, `HOSTNAME=0.0.0.0` (the standalone server
binds to localhost otherwise, and outside requests would hang) and `NEXT_TELEMETRY_DISABLED=1`.

[.dockerignore](../.dockerignore) keeps `.env` and `.env.*` out of the build context. This
matters because `next build` copies any `.env` it finds into `.next/standalone/.env`, which the
runner stage would then ship. It also excludes `.git`, `node_modules`, `.next`, `tests`,
`coverage`, `docs`, `*.md` and the Dockerfile itself (Docker reads that separately, and leaving
it out stops comment edits from invalidating the cache).

## How it was deployed

Deploys are run by hand from a workstation. CI ([ci.yml](../.github/workflows/ci.yml)) installs,
audits the production dependencies, checks, tests and builds; it does not deploy and holds no secret.

The source for a deploy is a directory made from `git archive` of the commit, not the working
tree:

```sh
DEPLOY_DIR="$(mktemp -d)"
git archive HEAD | tar -x -C "$DEPLOY_DIR"

gcloud run deploy ayojan --source "$DEPLOY_DIR" --region asia-south1 \
  --min-instances=0 --max-instances=1 --memory=512Mi --cpu=1 --timeout=60 \
  --allow-unauthenticated \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest,STATE_SEAL_KEY=state-seal-key:latest
```

Two rules come from the keyless twin, a revision of the same image deployed with `--tag nokey
--no-traffic` and only the seal key in `--set-secrets`:

- **Pass both secrets on every main deploy.** `--set-secrets` replaces the whole list, so after a
  `nokey` deploy the service template holds only `STATE_SEAL_KEY`. The command above names both.
- **After a `nokey` deploy, route traffic explicitly.** Traffic stays pinned by name, so a new main
  revision gets 0 percent until
  `gcloud run services update-traffic ayojan --region asia-south1 --to-revisions REVISION_NAME=100`
  is run; then check `status.traffic`. Do not use `--to-latest` while the keyless revision is the
  newest, because it would send all traffic to the revision with no Gemini key.

For the first deploy, on 26 Oct 2026, the directory was the archive of `f694edb`. gcloud
reported "Building using Dockerfile", created the revision `ayojan-00001-jxf`, and routed 100
percent of traffic to it. The second deploy, the same evening, used the archive of `a9184fe`
and created `ayojan-00002-7hr`, which took all traffic. The third, from the archive of `eb37d0d`,
created `ayojan-00003-lx6`; the fourth, from the archive of `e632246`, created `ayojan-00004-4vl`. The main deploys since
then, from the archives of `3ff942e` and `1abc9f6`, created `ayojan-00006-nhx`, `ayojan-00008-mr7`
and `ayojan-00009-v7q`, each routed by name as described above.

Why a git archive and not `--source .`:

- The archive holds tracked files only. The working tree of this repository also holds an
  untracked local `.env`, private planning notes, `node_modules` and build output, and none of
  them can enter the upload, whatever the ignore files say. The repository also has a
  [.gcloudignore](../.gcloudignore) that mirrors `.dockerignore` (except that it keeps the
  `Dockerfile`, which Cloud Build reads from the upload), so a `--source .` deploy would leave the
  same files out; the archive does not depend on getting that list right. The first revision was
  deployed before the `.gcloudignore` was added; the second was built from a tree that has it.
- The tree that is built is exactly the commit that was tested. An edit that was never
  committed cannot reach production.
- It is checkable: `git archive HEAD | tar -t` lists no `.env` and no `.planning` path (run on
  26 Oct 2026 against `f694edb` and `a9184fe`, with 0 matches each). `.env.example`, which has an empty value, is
  the only env file in it.

The flags, and why:

- `--min-instances=0`: the service scales to zero when idle, so an idle service holds no
  instance. The price is a cold start on the first request after a quiet period.
- `--max-instances=1`: a flood cannot start a second instance, and the one instance owns the
  whole daily model budget of 60 actions (one key, three models, about 20 calls each). The
  service has run one instance since `ayojan-00006-nhx` and one Gemini key from one project since
  `ayojan-00008-mr7` (D46, both 27 Oct 2026), because pooling free-tier keys from several
  projects can read as getting around Google's documented usage limits; the limits in
  [LIMITATIONS.md](LIMITATIONS.md) are sized for that. Revisions up to `ayojan-00005-zaz` ran with
  a maximum of 3, and revisions up to `ayojan-00006-nhx` on seven keys.
- `--timeout=60`: the app's own budget for one model action is 40 seconds
  (`ACTION_BUDGET_MS` in [gateway.ts](../src/server/genai/gateway.ts)), so a slow model fails
  with the app's own message inside Cloud Run's limit and not with a bare 504.
- `--set-secrets`: the keys come from Secret Manager, never `--set-env-vars`, so neither
  appears in the service definition or in a shell history.

## Secrets (names only)

| Secret           | Holds                                                          | Read as          |
| ---------------- | -------------------------------------------------------------- | ---------------- |
| `gemini-api-key` | one or more Gemini API keys separated by commas or whitespace  | `GEMINI_API_KEY` |
| `state-seal-key` | the 32-byte key, base64 encoded, that encrypts every plan link | `STATE_SEAL_KEY` |

The project's default compute service account holds `roles/secretmanager.secretAccessor` on
both. On 26 Oct 2026 `gemini-api-key` had two enabled versions and `state-seal-key` had one.
`/api/health` reported 7 keys in the pool that day (the public output was trimmed later and no
longer shows the key count; see the health endpoint section). The move to one key (D46) came on
27 Oct 2026: version 3 of `gemini-api-key` holds one of the seven keys, `ayojan-00008-mr7` was the
first revision to read it, and versions 1 and 2 are kept.

- **Changing the Gemini key** is `gcloud secrets versions add gemini-api-key --data-file=-`
  with the new key (or comma-separated list) on standard input (`printf`, not `echo`, so there is no
  trailing newline). Cloud Run reads a secret exposed as an environment variable when an
  instance starts, so a warm instance keeps the old list until it is replaced. Version 3 was added
  this way on 27 Oct 2026 and read by a new revision; a warm instance picking up a new version
  was not observed.
- **Rotating the seal key** makes every plan link issued so far stop opening, because there is
  one key and the link is authenticated with it ([seal-key.ts](../src/server/state/seal-key.ts)).
  Treat it as a break-glass step. While old and new instances overlap, a link sealed by one is
  refused by the other.
- Production refuses to run without the seal key (`SealKeyError`), so a missing secret shows up
  at once as a 503 from `/api/health` and not as links that die on the next cold start. Locally,
  without the variable, a random key for that process is used and a warning is printed.
- [.env.example](../.env.example) lists both variables with empty values. Locally, an empty
  `STATE_SEAL_KEY` behaves like a missing one: a random key for that process.

## The health endpoint

`GET /api/health` ([route.ts](../src/app/api/health/route.ts),
[health.ts](../src/server/observability/health.ts)) makes no model call, so probing it spends
no quota, and it is sent with `Cache-Control: no-store`. It reports:

- `status`: `ok`, or `unavailable` with a 503 when the seal key is missing or malformed, or
  when the planning data in `data/` fails to load. A keyless server is still healthy (200),
  because the form path works without a model; it reports `ai: "unavailable"`.
- `ai`: `available` when at least one Gemini key is configured.
- `sealKey`: `loaded`, `missing` or `malformed`.
- `data`: counts of tasks, levers and vendor questions read from `data/`.
- `readingCache`: `entries`, the number of readings held by this instance. An operator can read
  it to see whether readings will be served from the cache.
- `quota`: `actionsToday`, this instance's count of model actions in the current quota day.
- `problems`: the named reasons for a 503.

That is the whole public answer. The rest is behind `HEALTH_DETAIL=1` (off by default; set it on
the service only while debugging, for example with `gcloud run services update ayojan
--update-env-vars HEALTH_DETAIL=1`, and unset it afterwards). With it on, the answer gains a
`detail` object: `keys` (how many Gemini keys are configured, never the keys), `readingCache`
with its `bytes`, and `quota` with the counts for the quota day by model and key index, how many
model and key pairs and how many keys are cooling down after a refusal, and which models are.

Seen on 26 Oct 2026, about 18:00 IST, on revision `ayojan-00001-jxf`, with the output as it was
then (later trimmed, so the public answer no longer carries `keys` or the per-key counters):
`{"status":"ok","ai":"available","keys":7,"sealKey":"loaded","data":{"tasks":20,"levers":7,"questions":19},...,"problems":[]}`.
Seen again at about 20:15 IST on `ayojan-00002-7hr`, right after the second deploy: the same
status and counts, an empty reading cache and no model action yet on that instance.

The endpoint is public and unauthenticated, so the public answer is limited to what an operator
needs from outside. The key count and the per-key quota counters, which would show how much model
capacity is left, appear only with `HEALTH_DETAIL=1`. It holds no key material and no user text.
The numbers describe one instance. With `--max-instances=1` (since `ayojan-00006-nhx`; revisions up to `ayojan-00005-zaz` allowed 3) that is
the service, except briefly during a deploy, when an old and a new revision can both answer.

## Verifying a deploy

A successful `gcloud run deploy` proves only that a container started. After each deploy:

```sh
URL="$(gcloud run services describe ayojan --region asia-south1 --format='value(status.url)')"
curl -fsS "$URL/api/health"
gcloud run services describe ayojan --region asia-south1 \
  --format='value(spec.template.spec.timeoutSeconds,spec.template.metadata.annotations,status.traffic)'
```

The first must answer `"status":"ok"` (the key count is not in the public output; set
`HEALTH_DETAIL=1` to see it) with the expected counts (20 tasks, 7 levers, 19
questions), the second must show timeout 60, a maximum of 1 instance and 100 percent of
traffic on the new revision (after a `nokey` deploy, only once traffic has been routed by name, see
above). Then read one sample brief by hand in a signed-out browser.

What was checked against the first revision, `ayojan-00001-jxf`, on 26 Oct 2026 (the `/api/health`
rows quote the output of that day, which was later trimmed to drop the key count):

| Check                                                                            | Result                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/health`                                                                    | 200, `ok`, 7 keys, seal key loaded, 20 / 7 / 19 data counts                                                                                                                                                  |
| One Hinglish brief typed into the live reader                                    | answered in 5.2 s and matched 5 of 5 values; confirming it gave plan v1 (one request, an observation and not a benchmark)                                                                                    |
| One vendor quote with an instruction planted in it                               | read in 12.8 s; only values found in the user's own words were kept, and no vendor was marked booked or confirmed                                                                                            |
| Security headers on the start, plan, quotes, 404 and 405 responses               | present on every one: the nonce-based Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`; no `X-Powered-By`                                       |
| Browser load of a revision page with the live policy                             | no policy violation and no hydration error; the only console message was a 404 for `/favicon.ico` (fixed in `f51ab58`, live since `ayojan-00002-7hr`), and the running-total island updated without a submit |
| Time to first byte from the author's Windows machine                             | roughly 100 to 150 ms on the already-warm instance (10 requests per path after one warm-up; this includes the author's network path)                                                                         |
| 90 parallel POSTs to `/en/undo`, each with a different made-up `X-Forwarded-For` | 63 answered 415 and 27 answered 429, so the limiter keys on the address Google's front end appends, not on what the caller writes                                                                            |

What was checked against `ayojan-00002-7hr` the same evening (same note on the `/api/health` row):

| Check                                                                                       | Result                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/health`                                                                               | 200, `ok`, 7 keys, seal key loaded, 20 / 7 / 19 data counts, empty reading cache                                                                                                                                                                                                                |
| One Hinglish birthday brief, written for this check and not taken from a fixture            | answered in 28.4 s by `gemini-3.1-flash-lite`, the second rung of the ladder, which the check page named; 7 of 7 values matched; "budget dedh lakh rupaye" became Rs 1,50,000; confirming it gave a plan with 14 tasks On track and none Late (one request, an observation and not a benchmark) |
| A wedding entered through the form, with no model call                                      | 303 to a plan with no task Late                                                                                                                                                                                                                                                                 |
| A plan link made on `ayojan-00001-jxf` (the anniversary from the first check)               | still opens, with 200; with the new lead times it shows 13 tasks On track and none Late, where the first revision showed every task Late                                                                                                                                                        |
| Headers and icon                                                                            | `Permissions-Policy` includes `usb=()`; pages link `/icon.svg`, which answers 200                                                                                                                                                                                                               |
| Plan page at 360 px in Chromium (Playwright, mobile emulation), money table scrolled 120 px | the caption stayed in view (17 to 337 px), the page stayed 360 px wide, and the console showed no error                                                                                                                                                                                         |

What was checked against `ayojan-00003-lx6` that night, with no model call: `/api/health` answered
`ok` (then with a key count of 7, since trimmed from the public output), the seal key loaded and an empty reading cache; and in English and in Hindi, the
privacy sentence sits in the element that each read button names in `aria-describedby`, on the
start page (the brief and the example), in the plan's change box and on the quotes page.

What was checked against `ayojan-00004-4vl` on 27 Oct 2026, with one model call: a Hinglish brief
written for the check was read in 15.3 s by `gemini-3.5-flash-lite`; the confirmed plan v1 said "Not
priced yet (add a quote or a booking to compare)" and not "Within budget"; its family update made no
budget claim; a guest increase through the form gave "over budget by Rs 29,933" (an unpriced plan
that goes over still says so); and after a venue booking the status became a budget verdict.

What was checked against `ayojan-00009-v7q` on 28 Oct 2026: `npm run smoke` passed 18 of 18
against the live address, and `/api/health` answered `ok` with `ai: "available"`.

## Rollback

A rollback is a traffic change; an earlier revision keeps its own image:

```sh
gcloud run revisions list --service ayojan --region asia-south1
gcloud run services update-traffic ayojan --region asia-south1 --to-revisions REVISION_NAME=100
```

Pinning traffic to a named revision stops later deploys from receiving traffic by themselves.
To return to the newest revision, run `gcloud run services update-traffic ayojan --region
asia-south1 --to-latest`, unless the newest is a keyless `nokey` revision; then name the main
revision with `--to-revisions` instead. Plan links keep opening across revisions while the state schema version
is unchanged and the seal key is the same, which a rollback does not change.

## Still unverified

- **Rollback has not been run.** Earlier revisions are kept, and traffic has been moved by name
  to a new revision with `update-traffic` (27 Oct 2026), but never back to an earlier one. The commands above are the documented shape, not an exercised procedure.
- **Cold start time has not been measured.** The instance was already warm when it was probed,
  and the first-byte figure above is a warm one. A page carries about 132 KiB of gzip JavaScript
  (see [scripts/measure-pages.mjs](../scripts/measure-pages.mjs)), but how long a cold start
  adds is not known.
- **Behaviour with more than one running instance under load** (revisions up to
  `ayojan-00005-zaz` allowed three) was not seen; since `ayojan-00006-nhx` the service runs one. The 90-request burst
  above ran against whichever instance Cloud Run chose.
- **The client address on direct `run.app` traffic** is taken to be the entry Google's front end
  appends to `X-Forwarded-For`, from Google's documented behaviour and the made-up-header test
  above. It was only tried from one network.
- **A warm instance reading a new secret version** was not observed. Version 3 of
  `gemini-api-key` was added on 27 Oct 2026 and read by a newly deployed revision (see Secrets).
- **The size of the source upload** was not recorded.
- **A billing budget or alert** was not inspected. A budget alerts and never caps spending.
- **The keyless twin** (`ayojan-00008-tes`, tag `nokey`) is deployed, but no check against it is
  recorded on this page.
- **A throwaway service named `pw5-deploy-check`** (a ten-line Node server, used on 26 Oct 2026
  to prove Cloud Build, the public URL and the secret binding before the app was deployed) was
  deleted on 26 Oct 2026 at about 20:30 IST, with the owner's okay. It was not part of Ayojan.
