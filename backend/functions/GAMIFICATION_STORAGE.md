# Gamification storage

Keep current state separate from durable receipts that prevent duplicate payouts.
Reducing the number of collection names is not a reason to remove a receipt.

| Location | Responsibility |
| --- | --- |
| `users/{uid}.progress` | XP, level, streak, achievement counters |
| `users/{uid}.circleMemberships` | Server-maintained `{version: 1, ids: [...]}` lookup index; Circle member documents remain authoritative |
| `userStats/{uid}` | Ratings, mastery, and the daily match-reward taper |
| `wallets/{uid}` | Lumen, crate tokens, inventory, level claims, latest streak claim |
| `wallets/{uid}.taskRewards` | `{version: 1, dayKey, count}` for the current daily task allowance |
| `questBoards/{uid}` | Current quest slots, progress, completion state, instance cycles, daily reroll allowance |
| `rewardEvents/task_{taskId}` | Permanent first-completion receipt, including tasks deleted or recreated later |
| `gameResults/{gameId}` | Match settlement receipt, per-player rewards, rating changes, mastery comparison |
| `economyOps/{uid}_crate_{operationId}` | Immutable crate outcome; new receipts omit wallet snapshots |
| `economyOps/{uid}_tip_{operationId}` | Tip receipt bound to its resource and numeric amount |
| `circles/{id}/goals/grandQuest/contributions/{hash}` | Permanent quest-instance contribution receipt |
| `circles/{id}/grandQuestRounds/{cycle}` | Completed round, reward, and eligibility at completion |
| `circles/{id}/grandQuestClaims/{uid}` | Latest claimed round per member |

## Compatibility and rollout

- Deploy the backend and Firestore rules together before publishing the new signup
  client. The rules allow only an empty membership index at signup and protect it
  from subsequent client changes. They also protect match tapering and mastery.
- Before its first membership-sensitive operation, an existing account discovers
  legacy memberships outside the reward transaction. A separate transaction then
  rechecks the account and discovered memberships before initializing its index.
  Concurrent joins/leaves update the index and member documents atomically.
  New signups start with an empty index and need no discovery scan.
- On the first task-counter update, copy today's existing `taskRewardDays` count
  into the wallet. Subsequent updates reuse the wallet counter, resetting by day
  key. Old daily documents are neither deleted nor updated.
- Old crate receipts containing a wallet snapshot remain readable. New receipts
  replay the same drop and return the current wallet without charging again.
- Match settlement no longer creates `rewardEvents/match_*` documents. Historical
  records remain untouched; `gameResults` continues to guard settlement atomically.
- Drain older backend instances during rollout: an older task or membership writer
  does not maintain the new wallet counter or membership index.

## Transaction invariants

Complete all reads before writes. `readCircleContexts` accepts the candidate quest
instances; it reads only those receipt documents. A contribution without a prepared
receipt read is rejected. Call `writeCircleContextMigrations` only after all reads.
Circle totals use stored aggregates and match Elo deltas; membership changes
recompute the affected Circle's total. Listing Circles does not rewrite totals.

`writeAccount` sends only changed fields. A settled zero-reward event makes no
account writes, and an XP-only event does not touch the wallet unless it unlocks
an inventory item. Streak claims store their claim state and payout together.

Do not add TTL deletion to payment, task, match, or contribution receipts without
another permanent replay guard. In particular, retaining `alreadyCompleted` on a
task cannot protect an ID after that task is deleted and recreated.

## Verification

Run `npm test` and `npm run test:emulator` in `backend/functions`. The emulator
suite includes migration, daily rollover, concurrent claims and memberships,
numeric tip normalization, receipt replay, server-owned fields, and bounded query
checks. It uses uniquely named synthetic fixtures.

Local emulator hosts can be overridden with `FIRESTORE_EMULATOR_HOST` and
`FIREBASE_AUTH_EMULATOR_HOST` while `USE_FIREBASE_EMULATORS=true`, allowing an
isolated test suite alongside development emulators. The defaults remain ports
8080 and 9099.

The frontend refresh concurrency tests run with
`node --test frontend/src/features/economy/utils/snapshotRefresh.test.js` from the
repository root.
