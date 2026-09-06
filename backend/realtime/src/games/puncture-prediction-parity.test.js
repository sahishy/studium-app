import assert from "node:assert/strict";
import test from "node:test";
import {
  angularDistance as serverAngularDistance,
  createPunctureGame,
  generatePunctureRound,
  normalizeAngle as serverNormalizeAngle,
  PUNCTURE_COLLISION_DEGREES as SERVER_COLLISION_DEGREES,
  SHOT_TRAVEL_MS as SERVER_SHOT_TRAVEL_MS,
  SHOT_WORLD_ANGLE as SERVER_SHOT_WORLD_ANGLE,
  STUN_MS as SERVER_STUN_MS,
} from "./puncture.ts";
import {
  angularDistance as clientAngularDistance,
  normalizeAngle as clientNormalizeAngle,
  predictShot,
  PUNCTURE_COLLISION_DEGREES as CLIENT_COLLISION_DEGREES,
  SHOT_TRAVEL_MS as CLIENT_SHOT_TRAVEL_MS,
  SHOT_WORLD_ANGLE as CLIENT_SHOT_WORLD_ANGLE,
  STUN_MS as CLIENT_STUN_MS,
} from "../../../../frontend/src/features/multiplayer/games/puncture/puncturePrediction.js";

// The client predicts a Puncture shot's outcome locally, immediately on keypress, instead of
// waiting a full round trip (frontend/.../puncture/puncturePrediction.js). This test is what
// keeps that duplicated formula honest against the authoritative engine - if either side changes
// without the other, this fails.

test("prediction constants match the server exactly", () => {
  assert.equal(CLIENT_SHOT_WORLD_ANGLE, SERVER_SHOT_WORLD_ANGLE);
  assert.equal(CLIENT_SHOT_TRAVEL_MS, SERVER_SHOT_TRAVEL_MS);
  assert.equal(CLIENT_STUN_MS, SERVER_STUN_MS);
  assert.equal(CLIENT_COLLISION_DEGREES, SERVER_COLLISION_DEGREES);
});

test("normalizeAngle/angularDistance are identical to the server across a range of inputs", () => {
  for (let angle = -720; angle <= 720; angle += 17) {
    assert.equal(clientNormalizeAngle(angle), serverNormalizeAngle(angle), `normalizeAngle(${angle})`);
  }
  for (let first = 0; first < 360; first += 23) {
    for (let second = 0; second < 360; second += 29) {
      assert.equal(clientAngularDistance(first, second), serverAngularDistance(first, second), `angularDistance(${first}, ${second})`);
    }
  }
});

test("predictShot agrees with the authoritative engine's hit/miss decision across a matrix of shots", () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const round = generatePunctureRound(seed);
    // A minimal game already in "puncture_active", so handleAction("game.shoot") can be driven
    // directly at controlled times without going through the question/countdown phases.
    const game = {
      gameId: `parity-${seed}`, modeId: "sat-puncture", ranked: true, status: "active",
      players: [
        { userId: "p1", displayName: "One", profilePicture: null, state: { pinsRemaining: round.requiredPins, puncturePinAngles: [], punctureShotCount: 0 } },
        { userId: "p2", displayName: "Two", profilePicture: null, state: {} },
      ],
      state: {
        phase: "puncture_active",
        punctureRoundStartedAt: 0,
        punctureRoundDeadlineAt: 10_000_000,
        rotationTurnsPerSecond: round.rotationTurnsPerSecond,
        generatedPinAngles: round.generatedPinAngles,
      },
      privateState: {}, events: [], chat: [], startedAt: 0, updatedAt: 0,
    };
    const engine = createPunctureGame();

    for (let shotAt = 0; shotAt <= 4_000; shotAt += 137) {
      const player = game.players[0];
      const predicted = predictShot({
        shotAt,
        roundStartedAt: game.state.punctureRoundStartedAt,
        rotationTurnsPerSecond: game.state.rotationTurnsPerSecond,
        generatedPinAngles: game.state.generatedPinAngles,
        attachedPinAngles: player.state.puncturePinAngles,
      });
      const context = { now: shotAt, nowCompensated: shotAt, addEvent: () => {} };
      engine.handleAction(game, "p1", { id: `shot-${shotAt}`, type: "game.shoot", payload: {} }, context);
      assert.equal(Boolean(player.state.lastShotHit), predicted.hit, `hit mismatch seed=${seed} shotAt=${shotAt}`);
      if (!predicted.hit) {
        const actualAngle = player.state.puncturePinAngles.at(-1);
        assert.ok(Math.abs(actualAngle - predicted.attachedAngle) < 1e-9, `angle mismatch seed=${seed} shotAt=${shotAt}: ${actualAngle} vs ${predicted.attachedAngle}`);
      }
      // Clear the rate-limit/stun gates so the next sampled time isn't rejected as "too soon".
      player.state.lastShotAt = null;
      player.state.stunnedUntil = null;
      if (game.state.phase !== "puncture_active") break;
    }
  }
});
