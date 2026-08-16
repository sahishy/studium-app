import { changedAction, unchangedAction, type GameContext, type GameEngine, type StoredGame } from "./contracts";
import { isCorrectSatAnswer, sanitizeSatQuestion } from "./sat-questions";

export type TimberSide = "left" | "right";
export type TimberBranch = TimberSide | null;

const MAX_QUESTIONS = 10;
const SCORE_TO_WIN = 3;
const QUESTION_COUNTDOWN_MS = 3_000;
const QUESTION_MS = 120_000;
const POST_SUBMIT_GRACE_MS = 16_000;
const QUESTION_REVEAL_MS = 2_000;
const TIMBER_COUNTDOWN_MS = 3_000;
const TIMBER_ROUND_MS = 60_000;
const TIMBER_RESULT_MS = 3_000;
const MATCH_RESULT_MS = 3_000;
const STUN_MS = 2_000;
const MIN_CHOP_INTERVAL_MS = 50;
const VISIBLE_BRANCHES = 6;

export const getRequiredChops = (_roundIndex = 0) => 50;

const ADVANTAGES = {
  head_start: {
    id: "head_start",
    description: "Start with 10 of 50 chops completed.",
    apply: (progress: number) => progress + 10,
  },
} as const;

const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const generateBranchSequence = (seed: number, count = 80): TimberBranch[] => {
  let state = seed >>> 0 || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  let emptyRowsRemaining = 2;
  return Array.from({ length: count }, () => {
    if (emptyRowsRemaining > 0) {
      emptyRowsRemaining -= 1;
      return null;
    }
    if (random() < 0.28) return null;
    const branch: TimberSide = random() < 0.5 ? "left" : "right";
    const spacingRoll = random();
    emptyRowsRemaining = spacingRoll < 0.28 ? 1 : (spacingRoll < 0.72 ? 2 : 3);
    return branch;
  });
};

const finish = (game: StoredGame, winnerUserId: string | null, endReason: string, context: GameContext) => {
  game.status = "finished";
  game.state.phase = "finished";
  game.state.winnerUserId = winnerUserId;
  game.state.updatedAt = context.now;
  game.result = {
    gameId: game.gameId,
    modeId: game.modeId,
    ranked: game.ranked,
    playerIds: game.players.map((player) => player.userId),
    winnerUserId,
    scoreByUserId: Object.fromEntries(game.players.map((player) => [player.userId, Number(player.state.score) || 0])),
    roundsPlayed: Number(game.state.timberRoundsPlayed) || 0,
    endReason,
    startedAt: game.startedAt,
    endedAt: context.now,
  };
  context.addEvent("GAME_ENDED", { winnerUserId, endReason, eloDeltaByUserId: {} });
};

const beginMatchResult = (game: StoredGame, winnerUserId: string | null, endReason: "first_to_three" | "max_questions", context: GameContext) => {
  game.state.phase = "match_result";
  game.state.matchResultWinnerUserId = winnerUserId;
  game.state.matchResultEndReason = endReason;
  game.state.matchResultEndsAt = context.now + MATCH_RESULT_MS;
  game.state.phaseDeadlineAt = game.state.matchResultEndsAt;
};

const startQuestion = (game: StoredGame, context: GameContext) => {
  const index = Number(game.state.questionIndex) || 0;
  const questionId = game.state.questionIds[index] ?? null;
  game.state.phase = "question_active";
  game.state.currentQuestionId = questionId;
  game.state.currentQuestionStartedAt = context.now;
  game.state.currentQuestionActiveAt = context.now + QUESTION_COUNTDOWN_MS;
  game.state.currentQuestionDeadlineAt = context.now + QUESTION_COUNTDOWN_MS + QUESTION_MS;
  game.state.phaseDeadlineAt = game.state.currentQuestionDeadlineAt;
  game.privateState.answersByUserId = {};
  game.privateState.answerSequence = 0;
  game.players.forEach((player) => {
    player.state.answeredQuestionIds = [];
  });
  context.addEvent("QUESTION_STARTED", { questionIndex: index, questionId });
};

const startTimberCountdown = (game: StoredGame, context: GameContext) => {
  const roundIndex = Number(game.state.questionIndex) || 0;
  const requiredChops = getRequiredChops(roundIndex);
  const answers = game.privateState.answersByUserId ?? {};
  const fastestCorrect = game.players
    .map((player) => answers[player.userId])
    .filter((answer: any) => answer?.isCorrect)
    .sort((a: any, b: any) => Number(a.submissionOrder) - Number(b.submissionOrder))[0] ?? null;
  const advantageOwnerUserId = fastestCorrect?.userId ?? null;
  const seed = hashSeed(`${game.gameId}:${roundIndex}:${context.now}`);

  game.privateState.branchSequence = generateBranchSequence(seed);
  game.state.phase = "timber_countdown";
  game.state.requiredChops = requiredChops;
  game.state.timberRoundIndex = roundIndex;
  game.state.timberCountdownStartedAt = context.now + QUESTION_REVEAL_MS;
  game.state.timberCountdownEndsAt = game.state.timberCountdownStartedAt + TIMBER_COUNTDOWN_MS;
  game.state.phaseDeadlineAt = game.state.timberCountdownEndsAt;
  game.state.advantageOwnerUserId = advantageOwnerUserId;
  game.state.activeAdvantage = advantageOwnerUserId
    ? { id: ADVANTAGES.head_start.id, description: ADVANTAGES.head_start.description, ownerUserId: advantageOwnerUserId }
    : null;

  game.players.forEach((player) => {
    const hasAdvantage = player.userId === advantageOwnerUserId;
    player.state.timberProgress = hasAdvantage ? ADVANTAGES.head_start.apply(0) : 0;
    player.state.timberActualChops = 0;
    player.state.timberSide = "left";
    player.state.stunnedUntil = null;
    player.state.lastChopAt = null;
  });

  const questionId = game.state.currentQuestionId;
  const question = game.privateState.questionsById?.[questionId];
  const roundResults = game.players.map((player) => {
    const answer = answers[player.userId];
    return {
      userId: player.userId,
      submittedResponse: answer?.submittedResponse ?? null,
      isCorrect: Boolean(answer?.isCorrect),
      earnedAdvantage: player.userId === advantageOwnerUserId,
    };
  });
  context.addEvent("QUESTION_RESOLVED", {
    questionId,
    correctAnswer: question?.correctAnswerDisplay ?? question?.correctAnswer ?? null,
    roundResults,
    advantageOwnerUserId,
    advantage: game.state.activeAdvantage,
  });
  context.addEvent("TIMBER_COUNTDOWN_STARTED", { roundIndex, advantageOwnerUserId, advantage: game.state.activeAdvantage });
};

const resolveTimberRound = (game: StoredGame, winnerUserId: string | null, reason: "target_reached" | "timeout", context: GameContext) => {
  if (game.state.phase !== "timber_active") return;
  if (winnerUserId) {
    const winner = game.players.find((player) => player.userId === winnerUserId);
    if (winner) winner.state.score = (Number(winner.state.score) || 0) + 1;
  }
  game.state.timberRoundsPlayed = (Number(game.state.timberRoundsPlayed) || 0) + 1;
  const scoresByUserId = Object.fromEntries(game.players.map((player) => [player.userId, Number(player.state.score) || 0]));
  const progressByUserId = Object.fromEntries(game.players.map((player) => [player.userId, Number(player.state.timberProgress) || 0]));
  const remainingMs = Math.max(0, Number(game.state.timberRoundDeadlineAt || 0) - context.now);
  game.state.lastTimberResult = { winnerUserId, reason, scoresByUserId, progressByUserId, remainingMs };
  context.addEvent("TIMBER_ROUND_RESOLVED", {
    roundIndex: game.state.timberRoundIndex,
    winnerUserId,
    reason,
    scoresByUserId,
    progressByUserId,
    remainingMs,
  });

  if (winnerUserId && Number(game.players.find((player) => player.userId === winnerUserId)?.state.score) >= SCORE_TO_WIN) {
    beginMatchResult(game, winnerUserId, "first_to_three", context);
    return;
  }
  if (Number(game.state.timberRoundsPlayed) >= MAX_QUESTIONS) {
    beginMatchResult(game, null, "max_questions", context);
    return;
  }

  game.state.phase = "timber_result";
  game.state.timberResultEndsAt = context.now + TIMBER_RESULT_MS;
  game.state.phaseDeadlineAt = game.state.timberResultEndsAt;
};

const publicState = (game: StoredGame) => {
  const questionId = game.state.currentQuestionId;
  const question = game.privateState.questionsById?.[questionId];
  const sequence = game.privateState.branchSequence ?? [];
  const visibleBranchesByUserId = Object.fromEntries(game.players.map((player) => {
    const actualChops = Number(player.state.timberActualChops) || 0;
    return [player.userId, sequence.slice(actualChops, actualChops + VISIBLE_BRANCHES)];
  }));
  return {
    ...game.state,
    questionsById: questionId && game.state.phase === "question_active"
      ? { [questionId]: sanitizeSatQuestion(question) }
      : {},
    visibleBranchesByUserId,
  };
};

export const createTimberGame = (): GameEngine => ({
  initialize(game, questions, context) {
    const selected = questions.slice(0, MAX_QUESTIONS);
    const ids = selected.map((question) => question.id);
    game.privateState.questionsById = Object.fromEntries(selected.map((question) => [question.id, question]));
    game.state = {
      questionIndex: 0,
      questionIds: ids,
      maxQuestions: MAX_QUESTIONS,
      timberRoundsPlayed: 0,
      winnerUserId: null,
      startedAt: context.now,
    };
    game.players.forEach((player) => {
      player.state = { score: 0, answeredQuestionIds: [] };
    });
    startQuestion(game, context);
    context.addEvent("GAME_STARTED", { questionId: ids[0] ?? null });
  },
  handleAction(game, userId, message, context) {
    if (game.status !== "active") return unchangedAction();
    const player = game.players.find((entry) => entry.userId === userId);
    if (!player) return unchangedAction();

    if (message.type === "game.answer" && game.state.phase === "question_active") {
      if (context.now < Number(game.state.currentQuestionActiveAt || 0)) return unchangedAction();
      if (context.now >= Number(game.state.currentQuestionDeadlineAt || 0)) return unchangedAction();
      const questionId = game.state.currentQuestionId;
      const question = game.privateState.questionsById?.[questionId];
      const response = String((message.payload as any)?.submittedResponse ?? "").trim();
      if (!question || !response || (player.state.answeredQuestionIds as string[]).includes(questionId)) return unchangedAction();
      game.privateState.answerSequence = Number(game.privateState.answerSequence || 0) + 1;
      const answer = {
        userId,
        questionId,
        submittedResponse: response,
        elapsedMs: Math.max(0, context.now - Number(game.state.currentQuestionActiveAt)),
        submittedAt: context.now,
        submissionOrder: game.privateState.answerSequence,
        isCorrect: isCorrectSatAnswer(question, response),
      };
      game.privateState.answersByUserId[userId] = answer;
      player.state.answeredQuestionIds = [questionId];
      context.addEvent("ANSWER_SUBMITTED", { questionId }, userId);
      if (game.players.every((entry) => (entry.state.answeredQuestionIds as string[]).includes(questionId))) {
        startTimberCountdown(game, context);
      } else {
        game.state.currentQuestionDeadlineAt = Math.min(Number(game.state.currentQuestionDeadlineAt), context.now + POST_SUBMIT_GRACE_MS);
        game.state.phaseDeadlineAt = game.state.currentQuestionDeadlineAt;
      }
      return changedAction();
    }

    if (message.type !== "game.chop" || game.state.phase !== "timber_active") return unchangedAction();
    if (context.now >= Number(game.state.timberRoundDeadlineAt || 0)) return unchangedAction();
    const side = (message.payload as any)?.side;
    if (side !== "left" && side !== "right") return unchangedAction();
    if (context.now < Number(player.state.stunnedUntil || 0)) return unchangedAction();
    const lastChopAt = Number(player.state.lastChopAt || 0);
    if (lastChopAt && context.now - lastChopAt < MIN_CHOP_INTERVAL_MS) return unchangedAction();

    const actualChops = Number(player.state.timberActualChops) || 0;
    const branch = (game.privateState.branchSequence ?? [])[actualChops] as TimberBranch;
    player.state.lastChopAt = context.now;
    player.state.timberSide = side;
    player.state.timberActualChops = actualChops + 1;
    player.state.timberProgress = Math.min(Number(game.state.requiredChops), (Number(player.state.timberProgress) || 0) + 1);
    const hit = branch === side;
    if (hit) {
      player.state.stunnedUntil = context.now + STUN_MS;
      context.addEvent("PLAYER_STUNNED", { roundIndex: game.state.timberRoundIndex, stunnedUntil: player.state.stunnedUntil }, userId);
    }
    if (Number(player.state.timberProgress) >= Number(game.state.requiredChops)) {
      resolveTimberRound(game, userId, "target_reached", context);
    }
    return changedAction();
  },
  handleDeadline(game, context) {
    if (game.status !== "active" || context.now < Number(game.state.phaseDeadlineAt || 0)) return;
    if (game.state.phase === "question_active") {
      startTimberCountdown(game, context);
    } else if (game.state.phase === "timber_countdown") {
      game.state.phase = "timber_active";
      game.state.timberRoundStartedAt = context.now;
      game.state.timberRoundDeadlineAt = context.now + TIMBER_ROUND_MS;
      game.state.phaseDeadlineAt = game.state.timberRoundDeadlineAt;
      context.addEvent("TIMBER_ROUND_STARTED", { roundIndex: game.state.timberRoundIndex, requiredChops: game.state.requiredChops });
    } else if (game.state.phase === "timber_active") {
      const sorted = [...game.players].sort((a, b) => Number(b.state.timberProgress) - Number(a.state.timberProgress));
      const winner = Number(sorted[0]?.state.timberProgress) > Number(sorted[1]?.state.timberProgress) ? sorted[0].userId : null;
      resolveTimberRound(game, winner, "timeout", context);
    } else if (game.state.phase === "timber_result") {
      game.state.questionIndex = Number(game.state.questionIndex) + 1;
      startQuestion(game, context);
    } else if (game.state.phase === "match_result") {
      finish(game, game.state.matchResultWinnerUserId ?? null, game.state.matchResultEndReason ?? "first_to_three", context);
    }
  },
  publicState,
  nextDeadline(game) {
    return game.status === "active" ? Number(game.state.phaseDeadlineAt || 0) || null : null;
  },
  handleForfeit(game, leaverUserId, context) {
    if (game.state.phase === "match_result") {
      finish(game, game.state.matchResultWinnerUserId ?? null, game.state.matchResultEndReason ?? "first_to_three", context);
      return;
    }
    const winner = game.players.find((player) => player.userId !== leaverUserId)?.userId ?? null;
    finish(game, winner, "player_left", context);
  },
});
