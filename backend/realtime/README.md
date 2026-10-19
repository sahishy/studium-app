# Studium real-time service

This independent npm package runs on Cloudflare Workers with PartyServer and SQLite-backed Durable Objects. It owns transient multiplayer state: user sessions, social parties, per-mode matchmaking queues, live games, deadlines, reconnect grace periods, and bot chat.

Firebase remains the permanent source for authentication, questions, profiles, ratings, statistics, and completed results. The Worker calls the Firebase Functions API through `BACKEND_API_BASE_URL`.

## Local development

Install dependencies in both backend packages, then create the ignored `backend/realtime/.dev.vars` file:

```dotenv
BACKEND_API_BASE_URL=http://127.0.0.1:5001/YOUR_FIREBASE_PROJECT/us-central1/api
OPENAI_API_KEY=optional-for-bot-chat
REALTIME_ACTIVITY_SECRET=shared-local-development-secret
```

Start the services in separate terminals from the repository root:

```bash
npm run emulators:start
npm run realtime:dev
npm --prefix frontend run dev
```

Wrangler listens on port `8787`. The frontend defaults to `localhost:8787`, so `VITE_REALTIME_HOST` is optional locally. If a different host is needed, set only the hostname (and port), without `https://` or a path.

## Commands

- `npm run realtime:dev` starts the local Worker.
- `npm run realtime:check` regenerates binding types and type-checks the package.
- `npm run matchmaking:simulate` exercises the shared matchmaker.
- `npm run realtime:deploy` deploys the Worker from a developer machine.

## Cloudflare setup and deployment

Authenticate and configure production values from `backend/realtime`:

```bash
npx wrangler login
npx wrangler secret put BACKEND_API_BASE_URL
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put REALTIME_ACTIVITY_SECRET
npm run deploy
```

`OPENAI_API_KEY` is optional; gameplay continues without AI chat replies. Deployment creates the `studium-realtime` Worker and the `USER`, `PARTY`, `MATCHMAKER`, `GAME`, and `BOTCHAT` Durable Object namespaces from `wrangler.jsonc`. The initial URL is `studium-realtime.<account-subdomain>.workers.dev`.

Set the same `REALTIME_ACTIVITY_SECRET` value for the Firebase Functions runtime (with `firebase functions:secrets:set REALTIME_ACTIVITY_SECRET`) and the Worker. The secret is bound to the `api` function at deploy time and authorizes player activity updates and completed match result submissions.

For GitHub Actions deployment, add `CLOUDFLARE_API_TOKEN` and, when the token can access more than one account, `CLOUDFLARE_ACCOUNT_ID` as repository secrets. The workflow configures the Worker's `BACKEND_API_BASE_URL` from `VITE_BACKEND_API_BASE_URL`, so that repository secret must contain the deployed Firebase Functions API base URL. The main-branch workflow deploys the real-time Worker before deploying Firebase. Set `VITE_REALTIME_HOST` to the Worker hostname, without a scheme, before the frontend build runs.

The `/health` response reports `activityPublishingConfigured`. A false value means the Worker cannot project `online`, `in_party`, or `in_game` activity into public user profiles.

Stream production logs with:

```bash
npx wrangler tail
```

## Local latency checks

The Worker benchmark routes traffic through an ordered delay link in both directions and waits
for both acknowledgements and authoritative updates across 40/120/250 ms RTT profiles. Arcade
cadence, deadline handling and recovery are exercised by the GameServer integration regressions.
These local runs verify behavior; the isolated staging load tests below measure cloud performance.

The mode registry in `src/games/registry.ts` is the entry point for new modes. A mode supplies its player count, capabilities, and game engine; the shared matchmaker stays mode-independent.

## Multiplayer v4 and staged release

The Worker supports v3 patches and v4 input metadata independently. New matches use the
`REALTIME_V4_PERCENT` cohort (0 by default); stored matches keep their original version.
The GitHub repository variable of the same name controls production deployments. Arcade
inputs carry a round token, recovery epoch, sequence, action ID, and synced timestamp.
SAT answers remain scored at receipt time. Active movement is checkpointed every five
seconds; accepted answers, scores, phases, disconnects, and terminal state checkpoint immediately.

Configure a separate, randomly generated 32-byte `GAME_ADMISSION_SECRET` in the production
Worker and GitHub Actions secret of the same name to enable fifteen-minute assigned-player
admission tickets. Missing/expired tickets use the existing Firebase verifier. Tickets never
replace room membership checks. Profile/rating data is not accepted from the ticket query.

`REALTIME_METRICS_PERCENT` samples room aggregates (10 by default). `studium.latency` logs
include build ID, gameplay version, bounded timing distributions, storage counts, and rejection
reasons. Client summaries distinguish ACK, authoritative state, and the next observed animation
frame. Unacknowledged/expired actions are counted rather than silently omitted. Add
`?realtimeDiagnostics` to a development/debug page to expose `window.__studiumLatency()`.
The frame statistic is an observation after state publication; browser tests verify actual visuals.

### Isolated testing

Staging uses `wrangler.staging.jsonc`, separate Worker/DO namespaces, disposable questions and
identities, and zero-value fixture settlement. Its administrative fixture endpoints require a
separate secret and `STAGING_TEST_ENABLED=1`; production returns 404. Nothing writes to
production Firebase. The local staging launcher creates secrets in an ephemeral directory and
stores its test credential under ignored `.wrangler/` with owner-only permissions.

```sh
# From backend/realtime, in separate terminals:
npm run staging:dev
npm run staging:proxy

# From frontend (starts/reuses its required local services):
npm run test:multiplayer:browser

# From backend/realtime:
npm test
npm run test:worker
npm run test:proxy
npm run staging:load -- --rooms 100 --seconds 20 --proxy http://127.0.0.1:8790 --rtt 120 --jitter 30
```

The proxy is bound to loopback and delays actual WebSocket traffic in both directions, preserving
TCP ordering. Its OPEN handshake waits for upstream readiness so initial clock sampling excludes
cloud connection setup. Its local `/__network` control supports RTT, jitter, stalls, and disconnects.
Repeat with 40/0, 120/30, and 250/50 ms profiles. Browser coverage uses the production game
components and verifies two-client updates, disconnected input dropping, Flutter direction
resumption, overlapping Puncture flights, question transitions, and final settlement. The focused
Flutter reconnect fixture defers one ring so the test measures reconnect behavior separately
from legitimately losing a ring while disconnected.

```sh
# Requires an authenticated Cloudflare CLI; deploys staging only and creates its secrets:
npm run staging:deploy
npm run staging:load -- --credentials .wrangler/cloud-staging-credentials.json --rooms 100 --seconds 20 --report .wrangler/cloud-direct.json

# Point the local proxy at staging before running impaired cloud profiles:
# REALTIME_TARGET=https://studium-realtime-staging.<account>.workers.dev npm run staging:proxy
npm run staging:load -- --credentials .wrangler/cloud-staging-credentials.json --proxy http://127.0.0.1:8790 --rtt 250 --jitter 50 --report .wrangler/cloud-impaired.json

# From frontend, point browser acceptance at cloud staging (starts its own local proxy):
REALTIME_TEST_TARGET=https://studium-realtime-staging.<account>.workers.dev REALTIME_TEST_CREDENTIALS="$PWD/../backend/realtime/.wrangler/cloud-staging-credentials.json" npm run test:multiplayer:browser
```

Fixture commands `stats`, `deadline`, `finish`, `flightWindow`, and `dispose` apply only to
`load_` rooms in staging. Load runs clean up rooms/connections on completion or error. Never
expose the local proxy to the public network or enable staging fixtures on production.

### Release gates

Deploy Worker support before the frontend. Keep the production cohort at 0 while collecting
its v3-compatible baseline. Validate the staging reports and browser run, then use
`npm run rollout:check -- REPORT.json 10` before enabling the 10% new-match cohort. The report
must contain at least 100 settled cloud matches, no transport errors, p95 non-checkpoint
processing below 20 ms, and p95 authoritative feedback within measured RTT + 75 ms.
Attach the passing browser result as `browserAcceptancePassed=true` after reviewing it.
Compare the production baseline and record `productionBaselineCompared=true` before the first
10% cohort as well; the staging fixture results alone do not authorize activation.

For 50% and 100%, use the corresponding gate argument and a report from at least 100 completed
matches of the previous production cohort. Record `cohortPercent`,
`productionBaselineCompared=true`, and `settlementAndErrorRatesStable=true` only after reviewing
production logs and settlement/error rates. A synthetic staging result does not substitute for
these production cohort checks. Setting `REALTIME_V4_PERCENT=0` rolls back new-match assignment;
existing matches retain their version. The gate checks evidence; it never deploys automatically.

See [NETCODE_VALIDATION.md](NETCODE_VALIDATION.md) for the deployed staging measurements,
automated verification results, raw sanitized reports, and outstanding production release gates.
