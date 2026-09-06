import assert from "node:assert/strict";
import test from "node:test";
import {
  BOT_FILL_MAX_AFTER_MS,
  BOT_FILL_MIN_AFTER_MS,
  createBotFillAt,
  findBotFillEntries,
  findMatch,
} from "./matchmaking.ts";

const entry = (id, joinedAt, elo = 500, botFillAt = joinedAt + BOT_FILL_MIN_AFTER_MS) => ({
  id, joinedAt, averageElo: elo, userIds: [id],
  botFillAt,
  players: [{ userId: id, displayName: id, profilePicture: null, elo }],
});

test("assigns a bot-fill deadline within the configured five-to-ten-second range", () => {
  const joinedAt = 1_000;
  assert.equal(createBotFillAt(joinedAt, () => 0), joinedAt + BOT_FILL_MIN_AFTER_MS);
  assert.equal(createBotFillAt(joinedAt, () => 0.999999), joinedAt + BOT_FILL_MAX_AFTER_MS);
});

test("does not expose a queue entry to bot fill before its assigned deadline", () => {
  const queued = entry("one", 1_000, 500, 8_500);
  assert.deepEqual(findBotFillEntries([queued], 8_499), []);
  assert.deepEqual(findBotFillEntries([queued], 8_500), [queued]);
});

test("human matching remains available before bot fallback is considered", () => {
  const queue = [entry("first", 1_000, 500), entry("second", 2_000, 520)];
  assert.deepEqual(findMatch(queue, 2, 20_000)?.map(({ id }) => id), ["first", "second"]);
  assert.deepEqual(findBotFillEntries(queue, 20_000).map(({ id }) => id), ["first", "second"]);
});
