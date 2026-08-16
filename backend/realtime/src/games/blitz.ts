import { changedAction, unchangedAction, type GameEngine } from "./contracts";

const MAX_QUESTIONS = 10;
const PENALTY_MS = 20_000;
const comparable = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");

export const createBlitzGame = (): GameEngine => ({
  initialize(game, questions, context) {
    const selected = questions.slice(0, MAX_QUESTIONS);
    game.privateState.questions = selected;
    game.state = { phase: "active", questionIndex: 0, startedAt: context.now + 3_000, penaltyMs: 0, answers: [] };
  },
  handleAction(game, userId, message, context) {
    if (message.type !== "game.answer" || game.status !== "active" || context.now < Number(game.state.startedAt)) return unchangedAction();
    const index = Number(game.state.questionIndex);
    const question = game.privateState.questions[index];
    const response = String((message.payload as any)?.submittedResponse ?? "").trim();
    if (!question || !response) return unchangedAction();
    const correct = String(question.questionType).toLowerCase() === "spr"
      ? (question.acceptableAnswersComparable ?? []).includes(comparable(response))
      : response.toUpperCase() === question.correctAnswer;
    if (!correct) game.state.penaltyMs += PENALTY_MS;
    game.state.answers.push({
      questionId: question.id,
      submittedResponse: response,
      correctAnswer: question.correctAnswerDisplay ?? question.correctAnswer,
      isCorrect: correct,
    });
    context.addEvent("BLITZ_ANSWERED", { isCorrect: correct, correctAnswer: question.correctAnswerDisplay ?? question.correctAnswer, penaltyMs: correct ? 0 : PENALTY_MS });
    game.state.questionIndex += 1;
    if (game.state.questionIndex >= MAX_QUESTIONS) {
      const score = context.now - Number(game.state.startedAt) + Number(game.state.penaltyMs);
      game.status = "finished";
      game.state.phase = "finished";
      game.state.score = score;
      game.result = {
        gameId: game.gameId, modeId: game.modeId, ranked: false,
        playerIds: [userId], winnerUserId: userId, scoreByUserId: { [userId]: score },
        endReason: "completed", startedAt: Number(game.state.startedAt), endedAt: context.now,
      };
      context.addEvent("GAME_ENDED", { score });
    }
    return changedAction();
  },
  handleDeadline() {},
  publicState(game) {
    const question = game.privateState.questions?.[Number(game.state.questionIndex)];
    const safe = question ? Object.fromEntries(Object.entries(question).filter(([key]) => !["correctAnswer", "correctAnswerDisplay", "acceptableAnswers", "acceptableAnswersComparable"].includes(key))) : null;
    return { ...game.state, currentQuestion: safe };
  },
  nextDeadline() { return null; },
});
