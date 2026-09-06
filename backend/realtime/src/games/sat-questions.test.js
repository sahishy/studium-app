import assert from "node:assert/strict";
import test from "node:test";
import { buildReviewQuestionsById, sanitizeSatQuestion } from "./sat-questions.ts";

const questionsById = {
  resolved: {
    id: "resolved",
    module: "english",
    questionType: "mcq",
    paragraph: "Passage",
    prompt: "Prompt",
    choices: [{ id: "A", label: "Answer" }],
    correctAnswer: "A",
    correctAnswerDisplay: "A",
    acceptableAnswers: ["A"],
    acceptableAnswersComparable: ["a"],
  },
  unresolved: { id: "unresolved", prompt: "Secret future question", correctAnswer: "B" },
};

test("sanitized SAT questions never expose answer-key fields", () => {
  const safe = sanitizeSatQuestion(questionsById.resolved);
  assert.equal(safe.correctAnswer, undefined);
  assert.equal(safe.correctAnswerDisplay, undefined);
  assert.equal(safe.acceptableAnswers, undefined);
  assert.equal(safe.acceptableAnswersComparable, undefined);
  assert.equal(safe.prompt, "Prompt");
});

test("finished review data includes only questions named by resolved events", () => {
  const review = buildReviewQuestionsById(questionsById, [
    { type: "GAME_STARTED", data: { questionId: "unresolved" } },
    { type: "QUESTION_RESOLVED", data: { questionId: "resolved", correctAnswer: "A" } },
  ]);
  assert.deepEqual(Object.keys(review), ["resolved"]);
  assert.equal(review.resolved.prompt, "Prompt");
  assert.equal(review.resolved.correctAnswer, undefined);
});
