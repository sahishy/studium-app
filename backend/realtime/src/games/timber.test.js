import assert from "node:assert/strict";
import test from "node:test";
import { createTimberGame, generateBranchSequence, getRequiredChops } from "./timber.ts";

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
  gameId: "timber-test-game",
  modeId: "sat-timber",
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
  const setNow = (value) => { now = value; };
  const game = makeGame();
  const engine = createTimberGame();
  engine.initialize(game, questions, context());
  return { game, engine, context, setNow, events };
};

const answer = (engine, game, userId, response, context) => {
  engine.handleAction(game, userId, { id: `${userId}-${context.now}`, type: "game.answer", payload: { submittedResponse: response } }, context);
};

const enterTimber = (fixture, firstResponse = "A", secondResponse = "B") => {
  fixture.setNow(4_000);
  answer(fixture.engine, fixture.game, "p1", firstResponse, fixture.context());
  fixture.setNow(4_100);
  answer(fixture.engine, fixture.game, "p2", secondResponse, fixture.context());
  assert.equal(fixture.game.state.phase, "timber_countdown");
  fixture.setNow(Number(fixture.game.state.phaseDeadlineAt));
  fixture.engine.handleDeadline(fixture.game, fixture.context());
  assert.equal(fixture.game.state.phase, "timber_active");
};

test("initializes ten questions with a two-minute SAT deadline and private answers", () => {
  const { game, engine } = setup();
  assert.equal(game.state.phase, "question_active");
  assert.equal(game.state.currentQuestionActiveAt, 4_000);
  assert.equal(game.state.currentQuestionDeadlineAt, 124_000);
  assert.equal(game.state.questionIds.length, 10);
  const state = engine.publicState(game);
  assert.equal(state.questionsById["question-0"].correctAnswer, undefined);
});

test("uses a deterministic, single-sided branch sequence", () => {
  const first = generateBranchSequence(12345, 200);
  assert.deepEqual(first, generateBranchSequence(12345, 200));
  assert.notDeepEqual(first, generateBranchSequence(54321, 200));
  assert.ok(first.every((branch) => branch === null || branch === "left" || branch === "right"));
  const branchIndexes = first.map((branch, index) => branch ? index : null).filter((index) => index !== null);
  const gaps = branchIndexes.slice(1).map((index, position) => index - branchIndexes[position] - 1);
  assert.ok(gaps.every((gap) => gap >= 1));
  assert.ok(new Set(gaps).size >= 3);
  assert.equal(getRequiredChops(99), 50);
});

test("awards only the first correct answer the ten-chop advantage", () => {
  const fixture = setup();
  fixture.setNow(4_000);
  answer(fixture.engine, fixture.game, "p1", "A", fixture.context());
  assert.equal(fixture.game.state.currentQuestionDeadlineAt, 20_000);
  fixture.setNow(4_001);
  answer(fixture.engine, fixture.game, "p2", "A", fixture.context());
  assert.equal(fixture.game.state.advantageOwnerUserId, "p1");
  assert.equal(fixture.game.players[0].state.timberProgress, 10);
  assert.equal(fixture.game.players[1].state.timberProgress, 0);
  assert.equal(fixture.engine.publicState(fixture.game).questionsById["question-0"], undefined);
});

test("a question deadline with no answers grants no advantage", () => {
  const fixture = setup();
  fixture.setNow(Number(fixture.game.state.phaseDeadlineAt));
  answer(fixture.engine, fixture.game, "p1", "A", fixture.context());
  assert.deepEqual(fixture.game.players[0].state.answeredQuestionIds, []);
  fixture.engine.handleDeadline(fixture.game, fixture.context());
  assert.equal(fixture.game.state.phase, "timber_countdown");
  assert.equal(fixture.game.state.advantageOwnerUserId, null);
  assert.equal(fixture.game.players[0].state.timberProgress, 0);
  assert.equal(fixture.game.players[1].state.timberProgress, 0);
});

test("a branch hit counts the chop and blocks input for two seconds", () => {
  const fixture = setup();
  enterTimber(fixture);
  const player = fixture.game.players[0];
  const sequence = fixture.game.privateState.branchSequence;
  const hitIndex = sequence.findIndex((branch) => branch !== null);
  let now = Number(fixture.game.state.timberRoundStartedAt) + 50;
  for (let index = 0; index < hitIndex; index += 1) {
    const safeSide = sequence[index] === "left" ? "right" : "left";
    fixture.setNow(now);
    fixture.engine.handleAction(fixture.game, "p1", { id: `safe-${index}`, type: "game.chop", payload: { side: safeSide } }, fixture.context());
    now += 50;
  }
  const progressBefore = Number(player.state.timberProgress);
  fixture.setNow(now);
  fixture.engine.handleAction(fixture.game, "p1", { id: "hit", type: "game.chop", payload: { side: sequence[hitIndex] } }, fixture.context());
  assert.equal(player.state.timberProgress, progressBefore + 1);
  assert.equal(player.state.stunnedUntil, now + 2_000);
  fixture.setNow(now + 100);
  fixture.engine.handleAction(fixture.game, "p1", { id: "blocked", type: "game.chop", payload: { side: "left" } }, fixture.context());
  assert.equal(player.state.timberProgress, progressBefore + 1);
});

test("throttles chop bursts and exposes only the visible branch window", () => {
  const fixture = setup();
  enterTimber(fixture, "B", "B");
  const sequence = fixture.game.privateState.branchSequence;
  const startedAt = Number(fixture.game.state.timberRoundStartedAt);
  const firstSide = sequence[0] === "left" ? "right" : "left";
  fixture.setNow(startedAt + 50);
  fixture.engine.handleAction(fixture.game, "p1", { id: "first", type: "game.chop", payload: { side: firstSide } }, fixture.context());
  fixture.setNow(startedAt + 75);
  fixture.engine.handleAction(fixture.game, "p1", { id: "too-fast", type: "game.chop", payload: { side: "right" } }, fixture.context());
  assert.equal(fixture.game.players[0].state.timberActualChops, 1);
  const state = fixture.engine.publicState(fixture.game);
  assert.equal(state.visibleBranchesByUserId.p1.length, 6);
  assert.equal(JSON.stringify(state).includes("branchSequence"), false);
});

test("resolves timeout leaders and tied tenth rounds", () => {
  const leaderFixture = setup();
  enterTimber(leaderFixture, "B", "B");
  leaderFixture.game.players[0].state.timberProgress = 12;
  leaderFixture.game.players[1].state.timberProgress = 9;
  leaderFixture.setNow(Number(leaderFixture.game.state.phaseDeadlineAt));
  leaderFixture.engine.handleAction(leaderFixture.game, "p1", {
    id: "late-chop",
    type: "game.chop",
    payload: { side: "left" },
  }, leaderFixture.context());
  assert.equal(leaderFixture.game.players[0].state.timberActualChops, 0);
  leaderFixture.engine.handleDeadline(leaderFixture.game, leaderFixture.context());
  assert.equal(leaderFixture.game.players[0].state.score, 1);
  assert.equal(leaderFixture.game.state.phase, "timber_result");

  const drawFixture = setup();
  enterTimber(drawFixture, "B", "B");
  drawFixture.game.state.timberRoundsPlayed = 9;
  drawFixture.game.players[0].state.timberProgress = 7;
  drawFixture.game.players[1].state.timberProgress = 7;
  drawFixture.setNow(Number(drawFixture.game.state.phaseDeadlineAt));
  drawFixture.engine.handleDeadline(drawFixture.game, drawFixture.context());
  assert.equal(drawFixture.game.state.phase, "match_result");
  drawFixture.setNow(Number(drawFixture.game.state.phaseDeadlineAt));
  drawFixture.engine.handleDeadline(drawFixture.game, drawFixture.context());
  assert.equal(drawFixture.game.status, "finished");
  assert.equal(drawFixture.game.result?.winnerUserId, null);
  assert.equal(drawFixture.game.result?.endReason, "max_questions");
});

test("finishes at three points and handles ranked forfeits", () => {
  const fixture = setup();
  enterTimber(fixture);
  fixture.game.players[0].state.score = 2;
  fixture.game.players[0].state.timberProgress = 49;
  fixture.setNow(Number(fixture.game.state.timberRoundStartedAt) + 100);
  fixture.engine.handleAction(fixture.game, "p1", { id: "winning-chop", type: "game.chop", payload: { side: "left" } }, fixture.context());
  assert.equal(fixture.game.state.phase, "match_result");
  assert.equal(fixture.game.state.matchResultWinnerUserId, "p1");
  fixture.setNow(Number(fixture.game.state.phaseDeadlineAt));
  fixture.engine.handleDeadline(fixture.game, fixture.context());
  assert.equal(fixture.game.status, "finished");
  assert.equal(fixture.game.result?.winnerUserId, "p1");
  assert.equal(fixture.game.result?.scoreByUserId?.p1, 3);

  const forfeitFixture = setup();
  forfeitFixture.engine.handleForfeit?.(forfeitFixture.game, "p1", forfeitFixture.context());
  assert.equal(forfeitFixture.game.result?.winnerUserId, "p2");
  assert.equal(forfeitFixture.game.result?.endReason, "player_left");
});
