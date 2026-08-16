import assert from "node:assert/strict";
import test from "node:test";
import {
  FLUTTER_BOUNDS,
  FLUTTER_MAX_SPEED,
  createFlutterGame,
  generateFlutterRingCenters,
  getFlutterRingIntervalMs,
  integrateFlutterMotion,
} from "./flutter.ts";

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
  gameId: "flutter-test-game",
  modeId: "sat-flutter",
  ranked: true,
  status: "active",
  players: [
    { userId: "p1", displayName: "One", profilePicture: null, state: {} },
    { userId: "p2", displayName: "Two", profilePicture: null, state: {} },
  ],
  state: {}, privateState: {}, events: [], chat: [], startedAt: 1_000, updatedAt: 1_000,
});

const setup = () => {
  let now = 1_000;
  const events = [];
  const context = () => ({ now, addEvent: (type, data = {}, actorUserId = null) => events.push({ type, data, actorUserId }) });
  const game = makeGame();
  const engine = createFlutterGame();
  engine.initialize(game, questions, context());
  return { game, engine, context, events, setNow: (value) => { now = value; } };
};

const answer = (fixture, userId, response) => fixture.engine.handleAction(fixture.game, userId, {
  id: `${userId}-${fixture.context().now}`, type: "game.answer", payload: { submittedResponse: response },
}, fixture.context());

const enterFlutter = (fixture, first = "B", second = "B") => {
  fixture.setNow(4_000);
  answer(fixture, "p1", first);
  fixture.setNow(4_001);
  answer(fixture, "p2", second);
  assert.equal(fixture.game.state.phase, "flutter_countdown");
  fixture.setNow(Number(fixture.game.state.phaseDeadlineAt));
  fixture.engine.handleDeadline(fixture.game, fixture.context());
  assert.equal(fixture.game.state.phase, "flutter_active");
};

const place = (fixture, userId, x, y) => {
  const player = fixture.game.players.find((entry) => entry.userId === userId);
  player.state.flutterX = x;
  player.state.flutterY = y;
  player.state.flutterVelocityX = 0;
  player.state.flutterVelocityY = 0;
  player.state.flutterInput = { up: false, down: false, left: false, right: false };
  player.state.flutterLastUpdatedAt = Number(fixture.game.state.phaseDeadlineAt);
};

const passDeadline = (fixture) => {
  fixture.setNow(Number(fixture.game.state.phaseDeadlineAt));
  fixture.engine.handleDeadline(fixture.game, fixture.context());
};

test("generates deterministic, bounded rings and an accelerating schedule", () => {
  const first = generateFlutterRingCenters(42, 40);
  assert.deepEqual(first, generateFlutterRingCenters(42, 40));
  assert.notDeepEqual(first, generateFlutterRingCenters(43, 40));
  assert.deepEqual(first[0], { x: 0, y: 0 });
  first.forEach((ring) => {
    assert.ok(Math.abs(ring.x) <= 4.15);
    assert.ok(Math.abs(ring.y) <= 2.4);
  });
  assert.ok(getFlutterRingIntervalMs(1) > getFlutterRingIntervalMs(6));
  assert.ok(getFlutterRingIntervalMs(6) > getFlutterRingIntervalMs(10));
  assert.equal(getFlutterRingIntervalMs(100), getFlutterRingIntervalMs(1_000));
});

test("movement is normalized, responsive, and clamped to the flight bounds", () => {
  const straight = integrateFlutterMotion({ x: 0, y: 0, velocityX: 0, velocityY: 0, input: { up: false, down: false, left: false, right: true } }, 200);
  const diagonal = integrateFlutterMotion({ x: 0, y: 0, velocityX: 0, velocityY: 0, input: { up: true, down: false, left: false, right: true } }, 200);
  assert.ok(straight.velocityX <= FLUTTER_MAX_SPEED);
  assert.ok(Math.abs(Math.hypot(diagonal.velocityX, diagonal.velocityY) - straight.velocityX) < 0.01);
  const bounded = integrateFlutterMotion({ x: FLUTTER_BOUNDS.x, y: FLUTTER_BOUNDS.y, velocityX: 20, velocityY: 20, input: { up: true, down: false, left: false, right: true } }, 1_000);
  assert.equal(bounded.x, FLUTTER_BOUNDS.x);
  assert.equal(bounded.y, FLUTTER_BOUNDS.y);
});

test("sanitizes questions and gives one shield to the fastest correct answer", () => {
  const fixture = setup();
  assert.equal(fixture.engine.publicState(fixture.game).questionsById["question-0"].correctAnswer, undefined);
  fixture.setNow(4_000);
  answer(fixture, "p1", "A");
  fixture.setNow(4_001);
  answer(fixture, "p2", "A");
  assert.equal(fixture.game.state.advantageOwnerUserId, "p1");
  assert.equal(fixture.game.players[0].state.flutterShieldAvailable, true);
  assert.equal(fixture.game.players[1].state.flutterShieldAvailable, false);
  assert.equal(fixture.engine.publicState(fixture.game).questionsById["question-0"], undefined);
});

test("accepts fresh valid input and rejects stale or malformed input", () => {
  const fixture = setup();
  enterFlutter(fixture);
  const player = fixture.game.players[0];
  const accepted = fixture.engine.handleAction(fixture.game, "p1", { type: "game.flutterInput", payload: { sequence: 2, up: true, down: false, left: false, right: true } }, fixture.context());
  assert.equal(accepted.changed, true);
  assert.equal(accepted.delivery, "delta");
  assert.equal(player.state.flutterInputSequence, 2);
  const stale = fixture.engine.handleAction(fixture.game, "p1", { type: "game.flutterInput", payload: { sequence: 1, up: false, down: true, left: false, right: false } }, fixture.context());
  assert.equal(stale.changed, false);
  assert.equal(player.state.flutterInput.up, true);
  fixture.engine.handleAction(fixture.game, "p1", { type: "game.flutterInput", payload: { sequence: 3, up: "yes", down: false, left: false, right: false } }, fixture.context());
  assert.equal(player.state.flutterInputSequence, 2);
});

test("clears rings, accelerates, and automatically consumes a shield on a miss", () => {
  const fixture = setup();
  enterFlutter(fixture, "A", "B");
  const firstDeadline = Number(fixture.game.state.phaseDeadlineAt);
  // A visibly safe off-center pass should not be rejected by an oversized hitbox.
  place(fixture, "p1", 1.5, 0);
  place(fixture, "p2", -1.5, 0);
  passDeadline(fixture);
  assert.equal(fixture.game.state.flutterRingIndex, 1);
  assert.ok(Number(fixture.game.state.phaseDeadlineAt) - firstDeadline < 2_200);

  const center = generateFlutterRingCenters(Number(fixture.game.state.flutterSeed), 2)[1];
  place(fixture, "p1", FLUTTER_BOUNDS.x, FLUTTER_BOUNDS.y);
  place(fixture, "p2", center.x, center.y);
  passDeadline(fixture);
  assert.equal(fixture.game.state.phase, "flutter_active");
  assert.equal(fixture.game.players[0].state.flutterShieldAvailable, false);
  assert.equal(fixture.game.state.flutterRingIndex, 2);
  assert.ok(fixture.events.some((event) => event.type === "FLUTTER_SHIELD_CONSUMED" && event.actorUserId === "p1"));
});

test("scores for the survivor and retries a simultaneous miss without using a question", () => {
  const scoreFixture = setup();
  enterFlutter(scoreFixture);
  place(scoreFixture, "p1", 0, 0);
  place(scoreFixture, "p2", FLUTTER_BOUNDS.x, FLUTTER_BOUNDS.y);
  passDeadline(scoreFixture);
  assert.equal(scoreFixture.game.players[0].state.score, 1);
  assert.equal(scoreFixture.game.state.phase, "flutter_result");
  assert.equal(scoreFixture.game.state.flutterRoundsPlayed, 1);

  const retryFixture = setup();
  enterFlutter(retryFixture);
  place(retryFixture, "p1", FLUTTER_BOUNDS.x, FLUTTER_BOUNDS.y);
  place(retryFixture, "p2", -FLUTTER_BOUNDS.x, -FLUTTER_BOUNDS.y);
  passDeadline(retryFixture);
  assert.equal(retryFixture.game.state.lastFlutterResult.retry, true);
  assert.equal(retryFixture.game.state.questionIndex, 0);
  assert.equal(retryFixture.game.state.flutterRoundsPlayed, 0);
  passDeadline(retryFixture);
  assert.equal(retryFixture.game.state.phase, "flutter_countdown");
  assert.equal(retryFixture.game.state.questionIndex, 0);
  assert.equal(retryFixture.game.state.flutterAttempt, 1);
  assert.equal(retryFixture.game.state.advantageOwnerUserId, null);
});

test("ends at three points and handles forfeits", () => {
  const fixture = setup();
  enterFlutter(fixture);
  fixture.game.players[0].state.score = 2;
  place(fixture, "p1", 0, 0);
  place(fixture, "p2", FLUTTER_BOUNDS.x, FLUTTER_BOUNDS.y);
  passDeadline(fixture);
  assert.equal(fixture.game.state.phase, "match_result");
  assert.equal(fixture.game.state.matchResultWinnerUserId, "p1");
  passDeadline(fixture);
  assert.equal(fixture.game.result.winnerUserId, "p1");
  assert.equal(fixture.game.result.endReason, "first_to_three");

  const forfeit = setup();
  forfeit.engine.handleForfeit(forfeit.game, "p1", forfeit.context());
  assert.equal(forfeit.game.result.winnerUserId, "p2");
  assert.equal(forfeit.game.result.endReason, "player_left");
});
