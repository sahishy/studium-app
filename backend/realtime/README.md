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

Run `npx vitest run src/runtime.worker.test.ts -t 'measures action acknowledgements' --reporter=verbose --silent=false` from this package to sample one accepted answer action in each ranked mode. The impaired condition adds 120 ms before sending and 120 ms before displaying the acknowledgement. In the local Worker run on October 4, 2026, normal samples were 1 ms in all four modes; impaired samples were 243–245 ms. Each action produced one coalesced update. These are local Worker samples, not internet latency measurements.

While playing a local game, `window.__studiumLatency()` in the browser console reports per-room action counts, p50/p95 acknowledgement delay, rejected actions, resyncs, and visible prediction corrections. Timber counts rejected predicted chops; Puncture counts rejected or materially changed predicted shots; Flutter counts local avatar corrections over 0.2 world units. Classic has no spatial prediction. Compare a normal session with a throttled browser network session to inspect actual device and network behavior; these readings are intentionally kept out of the player UI.

The mode registry in `src/games/registry.ts` is the entry point for new modes. A mode supplies its player count, capabilities, and game engine; the shared matchmaker stays mode-independent.
