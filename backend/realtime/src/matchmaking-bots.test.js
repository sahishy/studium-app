import assert from "node:assert/strict";
import test from "node:test";
import { BOT_FILL_AFTER_MS, findBotFillEntries, findMatch } from "./matchmaking.ts";

const entry = (id, joinedAt, elo = 500) => ({
  id, joinedAt, averageElo: elo, userIds: [id],
  players: [{ userId: id, displayName: id, profilePicture: null, elo }],
});

test("does not expose a queue entry to bot fill before fifteen seconds", () => {
  const queued = entry("one", 1_000);
  assert.deepEqual(findBotFillEntries([queued], 1_000 + BOT_FILL_AFTER_MS - 1), []);
  assert.deepEqual(findBotFillEntries([queued], 1_000 + BOT_FILL_AFTER_MS), [queued]);
});

test("human matching remains available before bot fallback is considered", () => {
  const queue = [entry("first", 1_000, 500), entry("second", 2_000, 520)];
  assert.deepEqual(findMatch(queue, 2, 20_000)?.map(({ id }) => id), ["first", "second"]);
  assert.deepEqual(findBotFillEntries(queue, 20_000).map(({ id }) => id), ["first", "second"]);
});
