import assert from "node:assert/strict";
import test from "node:test";
import {
  createTimberGame,
  generateBranchSequence,
  MIN_CHOP_INTERVAL_MS as SERVER_MIN_CHOP_INTERVAL_MS,
  STUN_MS as SERVER_STUN_MS,
} from "./timber.ts";
import {
  generateBranchSequence as clientGenerateBranchSequence,
  MIN_CHOP_INTERVAL_MS as CLIENT_MIN_CHOP_INTERVAL_MS,
  predictChop,
  STUN_MS as CLIENT_STUN_MS,
  VISIBLE_BRANCHES,
} from "../../../../frontend/src/features/multiplayer/games/timber/timberPrediction.js";

// The client predicts a Timber chop's outcome locally, immediately on keypress, instead of
// waiting a full round trip (frontend/.../timber/timberPrediction.js). This test is what keeps
// that duplicated formula honest against the authoritative engine.

test("prediction constants match the server exactly", () => {
  assert.equal(CLIENT_MIN_CHOP_INTERVAL_MS, SERVER_MIN_CHOP_INTERVAL_MS);
  assert.equal(CLIENT_STUN_MS, SERVER_STUN_MS);
});

test("predictChop agrees with the authoritative engine's hit/miss decision across a matrix of chops", () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const branchSequence = generateBranchSequence(seed);
    const game = {
      gameId: `parity-${seed}`, modeId: "sat-timber", ranked: true, status: "active",
      players: [
        { userId: "p1", displayName: "One", profilePicture: null, state: { timberProgress: 0, timberActualChops: 0, timberSide: "left" } },
        { userId: "p2", displayName: "Two", profilePicture: null, state: {} },
      ],
      state: { phase: "timber_active", timberRoundDeadlineAt: 10_000_000, requiredChops: 50 },
      privateState: { branchSequence }, events: [], chat: [], startedAt: 0, updatedAt: 0,
    };
    const engine = createTimberGame();
    const sides = ["left", "right"];

    for (let i = 0; i < 60 && game.state.phase === "timber_active"; i += 1) {
      const player = game.players[0];
      const side = sides[i % 2];
      const actualChops = Number(player.state.timberActualChops) || 0;
      const visibleBranches = branchSequence.slice(actualChops, actualChops + VISIBLE_BRANCHES);
      const predicted = predictChop({ branches: visibleBranches, index: 0, side });

      const stunnedUntilBefore = Number(player.state.stunnedUntil) || 0;
      const now = i * 1000;
      const context = { now, nowCompensated: now, addEvent: () => {} };
      engine.handleAction(game, "p1", { id: `chop-${i}`, type: "game.chop", payload: { side } }, context);
      const actualHit = (Number(player.state.stunnedUntil) || 0) !== stunnedUntilBefore;
      assert.equal(actualHit, predicted.hit, `hit mismatch seed=${seed} i=${i} side=${side} branch=${visibleBranches[0]}`);

      // Isolate the next sampled chop from this one's rate-limit/stun gates.
      player.state.lastChopAt = null;
      player.state.stunnedUntil = null;
    }
  }
});

test("the client regenerates the exact branch sequence the engine plays from its published seed", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    assert.deepEqual(clientGenerateBranchSequence(seed), generateBranchSequence(seed), `seed=${seed}`);
  }
  // Degenerate seeds the xorshift has to agree on too (0 is coerced to 1 on both sides).
  for (const seed of [0, 1, 0xffffffff, 2 ** 31, 2166136261]) {
    assert.deepEqual(clientGenerateBranchSequence(seed), generateBranchSequence(seed), `seed=${seed}`);
  }
});

