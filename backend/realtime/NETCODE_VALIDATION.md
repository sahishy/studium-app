# Multiplayer v4 implementation and validation

Validated October 19, 2026. The implementation is in the working tree and deployed to the
isolated `studium-realtime-staging` Worker. Production has not been deployed or activated.
Cloudflare Worker version: `5f4e0366-d878-4618-8578-1ca7d3f3086a`.

## Implemented behavior

- One ordered deadline/input path, stable fast timers, and a five-second durable backstop
  independent of input volume. Connected question phases replace distant idle alarms.
- v4 timestamps, round tokens, recovery epochs, per-player sequences, bounded result caching,
  receipt-time abuse limits, and consistent Timber/Puncture action times. SAT scoring uses
  receipt time even if an earlier operation delays processing.
- Flutter retains 500 ms of motion history, judges each ring at its plane timestamp, and applies
  late controls forward without changing committed verdicts. Grace uses participant RTT/jitter,
  excluding spectators, and stays between 100 and 200 ms.
- Meaningful changes persist immediately; movement keeps the existing five/30-second recovery
  checkpoints. Recovery invalidates previous input epochs and client predictions.
- Fresh-snapshot/clock readiness, dropped disconnected presses, latest-direction Flutter
  resumption, retained leave intent, visible chat failures, and elapsed-time clock smoothing.
- 50 ms arcade patches, immediate phase/results publication, and overlapping keyed Puncture
  flights whose acknowledgements preserve their original animation timestamps.
- Participant-region matchmaking/first-lookup placement, preconnection during countdowns,
  batched question storage, room-scoped admission tickets, and independent settlement/session
  release with timeouts and durable retries.
- Bounded room/client latency summaries, protocol/build identifiers, isolated cloud fixtures,
  an ordered two-way impairment proxy, browser acceptance tests, and explicit rollout gates.

## Automated checks

| Check | Result |
| --- | --- |
| Backend engine, bot, protocol, placement, ticket tests | 117 passed |
| Actual Worker / Durable Object / WebSocket regressions | 19 passed |
| Ordered transport and real WebSocket proxy tests | 4 passed |
| Release gate evidence checks | 3 passed |
| Frontend multiplayer/shared regressions | 69 passed |
| Chrome browser acceptance against deployed Cloudflare | 5 passed |
| Worker TypeScript and targeted frontend lint | Passed |
| Frontend production build to temporary output | Passed |

Worker regressions cover overdue Flutter releases, compressed valid actions, actual sub-50 ms
presses, deduplication, stale scope, durable answers, recovery epochs, timer starvation, exactly
12 backstop writes per connected minute, receipt-time scoring, delayed settlement, and final-state
ordering. Clock tests include rising/falling RTT, 30/60/120 FPS, server processing delay, and
suspension. The existing v3 patch path remains covered independently of v4 inputs.

Browser tests exercise two Timber clients, two Puncture clients, disconnected input dropping,
Flutter release/reconnect synchronization, question-to-arcade transitions, and final settlement.
The real Puncture scene verifies visible motion within two animation callbacks (40 ms scheduling
tolerance), overlapping 75 ms flights, matching-node corrections, and immediate late settlement.
The focused Flutter reconnect fixture postpones one ring to separate reconnect correctness from
legitimately losing while disconnected.

## Deployed cloud load results

Each final profile used **100 concurrent rooms, 210 WebSocket connections, ten bot opponents,
and twenty spectators**, with a 20-second concurrent exercise after staggered connection setup.
All 100 rooms reached a published terminal state and completed fixture settlement per profile.
The synthetic clients use the production clock, patch application, and prediction helpers.

| Added proxy RTT / jitter | Measured p95 RTT | p95 ACK | p95 authoritative feedback | Transport errors | Settled |
| --- | ---: | ---: | ---: | ---: | ---: |
| 40 / 0 ms | 126.6 ms | 152.9 ms | 178.0 ms | 0 | 100/100 |
| 120 / 30 ms | 223.5 ms | 232.6 ms | 261.1 ms | 0 | 100/100 |
| 250 / 50 ms | 370.4 ms | 378.7 ms | 402.9 ms | 0 | 100/100 |

The proxy delay is **added to the real cloud connection**, not a replacement for internet RTT.
All final profiles meet p95 feedback <= measured p95 RTT + 75 ms. Reported server processing
and deadline-lateness p95 were 0 ms at the Worker's clock resolution; this is not a claim of
zero CPU cost. The separate alarm-count regression verifies the steady connected rate because
load-run totals also include initialization, staggered setup, phase changes, and terminal work.

Final runs had no `stale_sequence`, `decreasing_time`, `message_budget`, or `rate_limited`
rejections. Other rejections remain visible in the raw reports: the synthetic drivers continue
sending against delayed phase/stun information. The 120 ms profile rejected four expired inputs
(251–316 ms old); the 250 ms profile rejected 109 (250–329 ms old), outside the supported
250 ms action-age envelope. The 40 ms profile had no invalid timestamps. These are not counted
as accepted feedback samples. Tests separately cover legitimate timestamped inputs compressed
in transit and reject genuinely too-fast presses.

Raw sanitized reports: [40 ms](validation/cloud-40.json), [120 ms](validation/cloud-120.json),
[250 ms](validation/cloud-250.json). They contain no tickets or signing/test secrets.

An early heavy-jitter run failed the feedback target. Investigation found that the test proxy
could reorder equal-deadline timers and could report OPEN before its upstream TLS handshake
completed. It now drains one FIFO queue and waits for upstream readiness; regressions cover
2,000-message bursts and delayed handshakes. GameServer also serializes short mutations across
storage awaits. Final reports above were collected after these corrections.

## Remaining release gates

These are short, synthetic staging runs using disposable questions/identities and zero-value
settlement. They do not establish a production baseline, production reward/error rates,
long-duration reliability, device-wide rendering performance, or placement behavior from multiple
geographic test origins. Terminal load fixtures use a forfeit after exercising live gameplay;
they are not 300 naturally played full matches.

Production defaults to `REALTIME_V4_PERCENT=0`. Before activation, deploy Worker support with
measurement enabled, collect and compare the production baseline, configure the dedicated
`GAME_ADMISSION_SECRET`, and deploy the frontend after Worker support. Then enable 10%, 50%,
and 100% new-match cohorts only after reviewing at least 100 completed real matches per cohort
and stable settlement/error rates. `scripts/check-rollout.mjs` rejects missing baseline evidence.
The included staging reports intentionally retain `productionBaselineCompared=false`.

Rollback sets the new-match cohort to zero; stored matches retain their gameplay version.
See [README.md](README.md) for reproducible local/cloud commands and release instructions.
