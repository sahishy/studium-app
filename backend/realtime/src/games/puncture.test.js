import assert from "node:assert/strict";
import test from "node:test";
import {
  angularDistance,
  createPunctureGame,
  generatePunctureRound,
  GENERATED_PIN_SPACING_DEGREES,
  normalizeAngle,
} from "./puncture.ts";

const questions = Array.from({ length: 10 }, (_, index) => ({
  id: `question-${index}`,
  questionType: "mcq",
  prompt: `Question ${index + 1}`,
  choices: [{ id: "A", label: "Correct" }, { id: "B", label: "Wrong" }],
  correctAnswer: "A",
  correctAnswerDisplay: "A",
  difficulty: "Medium",
  module: "math",
}));

const makeGame = () => ({
  gameId: "puncture-test-game",
  modeId: "sat-puncture",
  ranked: true,
  status: "active",
  players: [
    { userId: "p1", displayName: "One", profilePicture: null, state: {} },
    { userId: "p2", displayName: "Two", profilePicture: null, state: {} },
  ],
  state: {},
  privateState: {},
  events: [],
  chat: [],
  startedAt: 1_000,
  updatedAt: 1_000,
});

const setup = () => {
  let now = 1_000;
  const events = [];
  const context = (nowCompensated = now) => ({
    now,
    nowCompensated,
    addEvent: (type, data = {}, actorUserId = null) => events.push({ type, data, actorUserId }),
  });
  const game = makeGame();
  const engine = createPunctureGame();
  engine.initialize(game, questions, context());
  return { game, engine, context, events, setNow: (value) => { now = value; } };
};

const answer = (fixture, userId, response) => {
  fixture.engine.handleAction(fixture.game, userId, {
    id: `${userId}-${fixture.context().now}`,
    type: "game.answer",
    payload: { submittedResponse: response },
  }, fixture.context());
};

const enterPuncture = (fixture, firstResponse = "B", secondResponse = "B") => {
  fixture.setNow(4_000);
  answer(fixture, "p1", firstResponse);
  fixture.setNow(4_100);
  answer(fixture, "p2", secondResponse);
  assert.equal(fixture.game.state.phase, "puncture_countdown");
  fixture.setNow(Number(fixture.game.state.phaseDeadlineAt));
  fixture.engine.handleDeadline(fixture.game, fixture.context());
  assert.equal(fixture.game.state.phase, "puncture_active");
};

const shoot = (fixture, userId, id = "shot") => {
  fixture.engine.handleAction(fixture.game, userId, { id, type: "game.shoot", payload: {} }, fixture.context());
};

test("generates deterministic fair round configurations within the initial ranges", () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const round = generatePunctureRound(seed);
    assert.deepEqual(round, generatePunctureRound(seed));
    assert.ok(round.requiredPins >= 18 && round.requiredPins <= 26);
    assert.ok(round.generatedPinCount >= 4 && round.generatedPinCount <= 6);
    assert.equal(round.generatedPinAngles.length, round.generatedPinCount);
    assert.ok(Math.abs(round.rotationTurnsPerSecond) >= 0.28);
    assert.ok(Math.abs(round.rotationTurnsPerSecond) <= 0.42);
    round.generatedPinAngles.forEach((angle, index) => {
      round.generatedPinAngles.slice(index + 1).forEach((other) => {
        assert.ok(angularDistance(angle, other) >= GENERATED_PIN_SPACING_DEGREES);
      });
    });
  }
  assert.notDeepEqual(generatePunctureRound(1), generatePunctureRound(2));
});

test("initializes sanitized SAT questions and awards only the fastest correct player", () => {
  const fixture = setup();
  assert.equal(fixture.game.state.currentQuestionActiveAt, 4_000);
  assert.equal(fixture.game.state.currentQuestionDeadlineAt, 124_000);
  assert.equal(fixture.engine.publicState(fixture.game).questionsById["question-0"].correctAnswer, undefined);

  fixture.setNow(4_000);
  answer(fixture, "p1", "A");
  fixture.setNow(4_001);
  answer(fixture, "p2", "A");
  const required = fixture.game.state.requiredPins;
  assert.equal(fixture.game.state.advantageOwnerUserId, "p1");
  assert.equal(fixture.game.players[0].state.pinsRemaining, Math.floor(required * 0.8));
  assert.equal(fixture.game.players[1].state.pinsRemaining, required);
  assert.equal(fixture.engine.publicState(fixture.game).questionsById["question-0"], undefined);
  assert.equal(JSON.stringify(fixture.engine.publicState(fixture.game)).includes("seed"), false);
});

test("a question deadline grants no advantage when nobody answers", () => {
  const fixture = setup();
  fixture.setNow(Number(fixture.game.state.phaseDeadlineAt));
  fixture.engine.handleDeadline(fixture.game, fixture.context());
  assert.equal(fixture.game.state.phase, "puncture_countdown");
  assert.equal(fixture.game.state.advantageOwnerUserId, null);
  assert.equal(fixture.game.players[0].state.pinsRemaining, fixture.game.state.requiredPins);
});

test("successful shots attach and decrement while collisions retain the pin and stun", () => {
  const fixture = setup();
  enterPuncture(fixture);
  const player = fixture.game.players[0];
  const startedAt = Number(fixture.game.state.punctureRoundStartedAt);

  fixture.game.state.generatedPinAngles = [];
  fixture.setNow(startedAt + 50);
  const before = Number(player.state.pinsRemaining);
  shoot(fixture, "p1", "success");
  assert.equal(player.state.pinsRemaining, before - 1);
  assert.equal(player.state.puncturePinAngles.length, 1);
  assert.equal(player.state.punctureShotCount, 1);

  fixture.setNow(startedAt + 100);
  const rotation = Number(fixture.game.state.rotationTurnsPerSecond) * 360 * 0.175;
  fixture.game.state.generatedPinAngles = [normalizeAngle(90 - rotation)];
  const remainingBeforeHit = Number(player.state.pinsRemaining);
  shoot(fixture, "p1", "collision");
  assert.equal(player.state.pinsRemaining, remainingBeforeHit);
  assert.equal(player.state.puncturePinAngles.length, 1);
  assert.equal(player.state.stunnedUntil, startedAt + 2_100);
  assert.equal(player.state.punctureShotCount, 2);

  fixture.setNow(startedAt + 200);
  shoot(fixture, "p1", "stun-blocked");
  assert.equal(player.state.punctureShotCount, 2);
});

test("collides with a player-attached pin and throttles shot bursts", () => {
  const fixture = setup();
  enterPuncture(fixture);
  const player = fixture.game.players[0];
  const startedAt = Number(fixture.game.state.punctureRoundStartedAt);
  fixture.game.state.generatedPinAngles = [];
  fixture.game.state.rotationTurnsPerSecond = 0;
  fixture.setNow(startedAt + 50);
  shoot(fixture, "p1", "first");
  fixture.setNow(startedAt + 75);
  shoot(fixture, "p1", "too-fast");
  assert.equal(player.state.punctureShotCount, 1);
  fixture.setNow(startedAt + 100);
  shoot(fixture, "p1", "attached-collision");
  assert.equal(player.state.punctureShotCount, 2);
  assert.equal(player.state.lastShotHit, true);
});

test("accepts a shot once and rejects a duplicate client action id", () => {
  const fixture = setup();
  enterPuncture(fixture);
  const player = fixture.game.players[0];
  const message = { id: "shot-delta", type: "game.shoot", payload: { clientActionId: "client-shot-1" } };
  const accepted = fixture.engine.handleAction(fixture.game, "p1", message, fixture.context());
  assert.equal(accepted.changed, true);
  assert.equal(accepted.reply?.type, "game.actionResult");
  assert.equal(accepted.reply?.payload.accepted, true);
  assert.equal(accepted.reply?.payload.shot.clientActionId, "client-shot-1");
  // The client-facing confirmation (clientActionId, hit/pinsRemaining, etc.) now flows through the
  // generic player.state diff (see servers/game-view.ts) rather than a hand-rolled delta payload.
  assert.equal(player.state.lastClientActionId, "client-shot-1");
  fixture.setNow(fixture.context().now + 100);
  const duplicate = fixture.engine.handleAction(fixture.game, "p1", message, fixture.context());
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.reply?.payload.accepted, true, "an idempotent retry returns the original accepted receipt");
  assert.deepEqual(duplicate.reply?.payload.shot, accepted.reply?.payload.shot);
});

test("returns exact shot geometry and private rejection reasons", () => {
  const fixture = setup();
  enterPuncture(fixture);
  const player = fixture.game.players[0];
  const startedAt = Number(fixture.game.state.punctureRoundStartedAt);
  fixture.game.state.rotationTurnsPerSecond = 0;
  fixture.game.state.generatedPinAngles = [90];
  fixture.setNow(startedAt + 100);

  const collision = fixture.engine.handleAction(fixture.game, "p1", {
    id: "collision", type: "game.shoot", payload: { clientActionId: "collision-client", shotAt: startedAt + 100 },
  }, fixture.context());
  assert.equal(collision.reply?.payload.accepted, true);
  assert.equal(collision.reply?.payload.shot.hit, true);
  assert.equal(collision.reply?.payload.shot.targetAngle, 90);
  assert.equal(collision.reply?.payload.shot.attachedAngle, null);
  assert.equal(collision.reply?.payload.shot.impactAt, startedAt + 175);

  const stunned = fixture.engine.handleAction(fixture.game, "p1", {
    id: "stunned", type: "game.shoot", payload: { clientActionId: "stunned-client", shotAt: startedAt + 200 },
  }, fixture.context());
  assert.equal(stunned.changed, false);
  assert.equal(stunned.reply?.payload.accepted, false);
  assert.equal(stunned.reply?.payload.reason, "stunned");
  assert.equal(player.state.punctureRecentShots.length, 1, "rejections are not added to public history");
});

test("keeps only the latest sixteen authoritative shot receipts", () => {
  const fixture = setup();
  enterPuncture(fixture);
  const player = fixture.game.players[0];
  const startedAt = Number(fixture.game.state.punctureRoundStartedAt);
  fixture.game.state.generatedPinAngles = [];
  fixture.game.state.rotationTurnsPerSecond = 0.3;
  player.state.pinsRemaining = 100;

  for (let sequence = 1; sequence <= 20; sequence += 1) {
    fixture.setNow(startedAt + (sequence * 100));
    const result = fixture.engine.handleAction(fixture.game, "p1", {
      id: `shot-${sequence}`,
      type: "game.shoot",
      payload: { clientActionId: `client-${sequence}` },
    }, fixture.context());
    assert.equal(result.changed, true, `shot ${sequence} should be accepted`);
  }

  assert.equal(player.state.punctureRecentShots.length, 16);
  assert.equal(player.state.punctureRecentShots[0].sequence, 5);
  assert.equal(player.state.punctureRecentShots.at(-1).sequence, 20);
});

test("resolves target wins, timeout leaders, and a tied tenth round", () => {
  const targetFixture = setup();
  enterPuncture(targetFixture);
  targetFixture.game.state.generatedPinAngles = [];
  targetFixture.game.players[0].state.score = 2;
  targetFixture.game.players[0].state.pinsRemaining = 1;
  targetFixture.setNow(Number(targetFixture.game.state.punctureRoundStartedAt) + 50);
  shoot(targetFixture, "p1", "winning-shot");
  assert.equal(targetFixture.game.state.phase, "match_result");
  assert.equal(targetFixture.game.state.matchResultWinnerUserId, "p1");

  const leaderFixture = setup();
  enterPuncture(leaderFixture);
  leaderFixture.game.players[0].state.pinsRemaining = 4;
  leaderFixture.game.players[1].state.pinsRemaining = 7;
  leaderFixture.setNow(Number(leaderFixture.game.state.phaseDeadlineAt));
  shoot(leaderFixture, "p1", "late-shot");
  leaderFixture.engine.handleDeadline(leaderFixture.game, leaderFixture.context());
  assert.equal(leaderFixture.game.players[0].state.score, 1);
  assert.equal(leaderFixture.game.state.phase, "puncture_result");

  const drawFixture = setup();
  enterPuncture(drawFixture);
  drawFixture.game.state.punctureRoundsPlayed = 9;
  drawFixture.game.players[0].state.pinsRemaining = 5;
  drawFixture.game.players[1].state.pinsRemaining = 5;
  drawFixture.setNow(Number(drawFixture.game.state.phaseDeadlineAt));
  drawFixture.engine.handleDeadline(drawFixture.game, drawFixture.context());
  assert.equal(drawFixture.game.state.phase, "match_result");
  drawFixture.setNow(Number(drawFixture.game.state.phaseDeadlineAt));
  drawFixture.engine.handleDeadline(drawFixture.game, drawFixture.context());
  assert.equal(drawFixture.game.result?.winnerUserId, null);
  assert.equal(drawFixture.game.result?.endReason, "max_questions");
});

test("compensates shot timing for latency without weakening the rate limit", () => {
  const fixture = setup();
  enterPuncture(fixture);
  const player = fixture.game.players[0];
  const startedAt = Number(fixture.game.state.punctureRoundStartedAt);
  fixture.game.state.generatedPinAngles = [];

  // Place the pin where it was 125ms into the round (the shooter's true input time + 75ms travel).
  const compensatedElapsedMs = 50 + 75;
  const rotation = Number(fixture.game.state.rotationTurnsPerSecond) * 360 * (compensatedElapsedMs / 1000);
  fixture.game.state.generatedPinAngles = [normalizeAngle(90 - rotation)];

  // The message doesn't arrive until 300ms in (simulating high RTT), but the client's actual
  // input happened around 50ms in, so the server compensates using nowCompensated.
  fixture.setNow(startedAt + 300);
  fixture.engine.handleAction(fixture.game, "p1", { id: "late-shot", type: "game.shoot", payload: {} }, fixture.context(startedAt + 50));
  assert.equal(player.state.lastShotHit, true, "a compensated shot should hit the pin at the player's true input time");

  // The per-shot rate limit must still key off raw receive time, not the compensated time,
  // so a high-RTT connection can't be used to fire faster than MIN_SHOT_INTERVAL_MS.
  fixture.setNow(startedAt + 320);
  fixture.engine.handleAction(fixture.game, "p1", { id: "too-fast", type: "game.shoot", payload: {} }, fixture.context(startedAt + 60));
  assert.equal(player.state.punctureShotCount, 1, "a second shot 20ms of raw time later must still be throttled");
});

test("handles ranked forfeits", () => {
  const fixture = setup();
  fixture.engine.handleForfeit(fixture.game, "p1", fixture.context());
  assert.equal(fixture.game.result?.winnerUserId, "p2");
  assert.equal(fixture.game.result?.endReason, "player_left");
});
