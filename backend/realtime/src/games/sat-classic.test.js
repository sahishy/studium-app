import assert from "node:assert/strict";
import test from "node:test";
import { createSatClassicGame } from "./sat-classic.ts";

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
  gameId: "sat-classic-test-game",
  modeId: "sat-classic",
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

test("Classic rejects deadline answers and resolves the round server-side", () => {
  const game = makeGame();
  const engine = createSatClassicGame();
  const events = [];
  const context = (now, nowCompensated = now) => ({
    now,
    nowCompensated,
    addEvent: (type, data = {}, actorUserId = null) => events.push({ type, data, actorUserId }),
  });

  engine.initialize(game, questions, context(1_000));
  const deadline = Number(game.state.currentRoundDeadlineAt);
  engine.handleAction(game, "p1", {
    id: "late-answer",
    type: "game.answer",
    payload: { submittedResponse: "A" },
  }, context(deadline));

  assert.deepEqual(game.players[0].state.answeredQuestionIds, []);
  assert.equal(events.some((event) => event.type === "ANSWER_SUBMITTED"), false);

  engine.handleDeadline(game, context(deadline));
  assert.equal(game.state.questionIndex, 1);
  assert.equal(events.filter((event) => event.type === "ROUND_RESOLVED").length, 1);
});

test("Classic exposes sanitized resolved questions only after the match finishes", () => {
  const game = makeGame();
  const engine = createSatClassicGame();
  engine.initialize(game, questions, { now: 1_000, nowCompensated: 1_000, addEvent() {} });
  assert.equal(engine.publicState(game).reviewQuestionsById, undefined);

  game.events.push({ type: "ROUND_RESOLVED", data: { questionId: "question-0", correctAnswer: "A" } });
  game.state.phase = "finished";
  const state = engine.publicState(game);
  assert.equal(state.reviewQuestionsById["question-0"].prompt, "Question 1");
  assert.equal(state.reviewQuestionsById["question-0"].correctAnswer, undefined);
  assert.equal(state.reviewQuestionsById["question-1"], undefined);
  assert.deepEqual(state.questionsById, {});
});
