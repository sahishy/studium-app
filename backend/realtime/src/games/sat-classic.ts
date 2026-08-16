import type { GameEngine, StoredGame } from "./contracts";
import { isCorrectSatAnswer, sanitizeSatQuestion } from "./sat-questions";

const INITIAL_HEALTH = 3000;
const MAX_QUESTIONS = 10;
const ROUND_MS = 183_000;
const OVERLAY_MS = 3_000;
const BASE_DAMAGE: Record<string, number> = { Easy: 800, Medium: 1000, Hard: 1400 };

const finish = (game: StoredGame, winnerUserId: string | null, endReason: string, now: number) => {
  game.status = "finished";
  game.state.phase = "finished";
  game.state.winnerUserId = winnerUserId;
  game.state.updatedAt = now;
  game.result = {
    gameId: game.gameId,
    modeId: game.modeId,
    ranked: game.ranked,
    playerIds: game.players.map((player) => player.userId),
    winnerUserId,
    roundsPlayed: Number(game.state.questionIndex || 0) + 1,
    endReason,
    startedAt: game.startedAt,
    endedAt: now,
  };
};

const resolveRound = (game: StoredGame, now: number, addEvent: (type: string, data?: any, actor?: string | null) => void) => {
  const questionId = game.state.currentQuestionId;
  const question = game.privateState.questionsById?.[questionId];
  if (!question || game.state.phase === "finished") return;
  const index = Number(game.state.questionIndex || 0);
  const roundMultiplier = Number((1 + index * 0.1).toFixed(1));
  const results = game.players.map((player) => {
    const answer = (player.state.lastAnswer as any) ?? {};
    const correct = answer.questionId === questionId && Boolean(answer.isCorrect);
    const elapsedMs = Number(answer.elapsedMs || ROUND_MS);
    const timeMultiplier = 0.35 + 0.65 / (1 + elapsedMs / 8000);
    const baseDamage = correct ? (BASE_DAMAGE[question.difficulty] ?? BASE_DAMAGE.Medium) : 0;
    return {
      userId: player.userId,
      isCorrect: correct,
      submittedResponse: answer.submittedResponse ?? null,
      elapsedMs,
      baseDamage,
      timeMultiplier,
      roundMultiplier,
      answeredFirstMultiplier: 1,
      damageRaw: Math.round(baseDamage * timeMultiplier * roundMultiplier),
    };
  });
  const correctResults = results.filter((result) => result.isCorrect).sort((a, b) => {
    const aa = Number((game.players.find((p) => p.userId === a.userId)?.state.lastAnswer as any)?.elapsedMs || ROUND_MS);
    const bb = Number((game.players.find((p) => p.userId === b.userId)?.state.lastAnswer as any)?.elapsedMs || ROUND_MS);
    return aa - bb;
  });
  if (correctResults.length > 1) {
    correctResults[0].answeredFirstMultiplier = 1.5;
    correctResults[0].damageRaw = Math.round(correctResults[0].damageRaw * 1.5);
  }
  const [a, b] = results;
  if (a && b) {
    const delta = a.damageRaw - b.damageRaw;
    const target = delta > 0 ? game.players.find((p) => p.userId === b.userId) : game.players.find((p) => p.userId === a.userId);
    if (target) target.state.health = Math.max(0, Number(target.state.health) - Math.abs(delta));
  }
  addEvent("ROUND_RESOLVED", {
    questionId,
    correctAnswer: question.correctAnswerDisplay ?? question.correctAnswer,
    roundResults: results,
  });
  const knockedOut = game.players.find((player) => Number(player.state.health) <= 0);
  const lastQuestion = index + 1 >= Number(game.state.maxQuestions || MAX_QUESTIONS);
  if (knockedOut || lastQuestion) {
    const sorted = [...game.players].sort((x, y) => Number(y.state.health) - Number(x.state.health));
    const winner = sorted[0] && Number(sorted[0].state.health) !== Number(sorted[1]?.state.health) ? sorted[0].userId : null;
    finish(game, winner, knockedOut ? "knockout" : "max_questions", now);
    addEvent("GAME_ENDED", { winnerUserId: winner, endReason: game.result?.endReason, eloDeltaByUserId: {} });
    return;
  }
  game.state.questionIndex = index + 1;
  game.state.currentQuestionId = game.state.questionIds[index + 1];
  game.state.currentRoundStartedAt = now;
  game.state.currentRoundDeadlineAt = now + ROUND_MS;
  game.state.currentRoundMultiplier = Number((1 + (index + 1) * 0.1).toFixed(1));
  game.players.forEach((player) => { player.state.lastAnswer = null; });
  addEvent("ROUND_STARTED", { questionIndex: index + 1, questionId: game.state.currentQuestionId });
};

export const createSatClassicGame = (): GameEngine => ({
  initialize(game, questions, context) {
    const selected = questions.slice(0, MAX_QUESTIONS);
    const ids = selected.map((question) => question.id);
    game.privateState.questionsById = Object.fromEntries(selected.map((question) => [question.id, question]));
    game.state = {
      phase: "question_active",
      questionIndex: 0,
      questionIds: ids,
      currentQuestionId: ids[0] ?? null,
      maxQuestions: MAX_QUESTIONS,
      startedAt: context.now,
      currentRoundStartedAt: context.now,
      currentRoundDeadlineAt: context.now + ROUND_MS,
      currentRoundMultiplier: 1,
    };
    game.players.forEach((player) => {
      player.state = { health: INITIAL_HEALTH, answeredQuestionIds: [], lastAnswer: null };
    });
    context.addEvent("GAME_STARTED", { questionId: ids[0] });
  },
  handleAction(game, userId, message, context) {
    if (message.type !== "game.answer" || game.status !== "active") return;
    if (context.now >= Number(game.state.currentRoundDeadlineAt || 0)) return;
    const player = game.players.find((entry) => entry.userId === userId);
    const questionId = game.state.currentQuestionId;
    const question = game.privateState.questionsById?.[questionId];
    const response = String((message.payload as any)?.submittedResponse ?? "").trim();
    if (!player || !question || !response || (player.state.answeredQuestionIds as string[]).includes(questionId)) return;
    const elapsedMs = Math.max(0, context.now - Number(game.state.currentRoundStartedAt));
    player.state.answeredQuestionIds = [...(player.state.answeredQuestionIds as string[]), questionId];
    player.state.lastAnswer = { questionId, submittedResponse: response, elapsedMs, isCorrect: isCorrectSatAnswer(question, response) };
    context.addEvent("ANSWER_SUBMITTED", { questionId }, userId);
    if (game.players.every((entry) => (entry.state.answeredQuestionIds as string[]).includes(questionId))) {
      resolveRound(game, context.now, context.addEvent);
    } else {
      game.state.currentRoundDeadlineAt = Math.min(Number(game.state.currentRoundDeadlineAt), context.now + 16_000);
    }
  },
  handleDeadline(game, context) {
    if (game.status === "active" && context.now >= Number(game.state.currentRoundDeadlineAt || 0)) {
      resolveRound(game, context.now, context.addEvent);
    }
  },
  publicState(game) {
    const currentId = game.state.currentQuestionId;
    const question = game.privateState.questionsById?.[currentId];
    const safeQuestion = sanitizeSatQuestion(question);
    return { ...game.state, questionsById: currentId ? { [currentId]: safeQuestion } : {} };
  },
  nextDeadline(game) {
    return game.status === "active" ? Number(game.state.currentRoundDeadlineAt || 0) || null : null;
  },
  handleForfeit(game, leaverUserId, context) {
    forfeitSatClassic(game, leaverUserId, context.now);
  },
});

export const forfeitSatClassic = (game: StoredGame, leaverUserId: string, now: number) => {
  const winner = game.players.find((player) => player.userId !== leaverUserId)?.userId ?? null;
  finish(game, winner, "player_left", now);
};
