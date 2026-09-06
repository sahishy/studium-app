import { changedAction, unchangedAction, type GameContext, type GameEngine, type StoredGame } from "./contracts";
import { buildReviewQuestionsById, isCorrectSatAnswer, sanitizeSatQuestion } from "./sat-questions";

const MAX_QUESTIONS = 10;
const SCORE_TO_WIN = 3;
const QUESTION_COUNTDOWN_MS = 3_000;
const QUESTION_MS = 120_000;
const POST_SUBMIT_GRACE_MS = 16_000;
const QUESTION_REVEAL_MS = 2_000;
const PUNCTURE_COUNTDOWN_MS = 3_000;
const PUNCTURE_ROUND_MS = 30_000;
const PUNCTURE_RESULT_MS = 3_000;
const MATCH_RESULT_MS = 3_000;
const MIN_SHOT_INTERVAL_MS = 50;
const RECENT_SHOT_LIMIT = 16;
// How far a client-reported shotAt may diverge from the server's own compensated receipt time
// before it's clamped. Lets an honest client's exact keydown instant drive the authoritative angle
// (matching what it predicted) while bounding how much a modified client could shift a shot to
// dodge the collision window.
const CLIENT_SHOT_AT_CLAMP_MS = 200;

// Exported so the client can predict a shot's outcome locally, using the exact same formula,
// instead of waiting a full round trip - see frontend/.../puncture/puncturePrediction.js, kept
// in sync by backend/realtime/src/games/puncture-prediction-parity.test.js.
export const STUN_MS = 2_000;
export const SHOT_WORLD_ANGLE = 90;
export const SHOT_TRAVEL_MS = 75;
export const PUNCTURE_COLLISION_DEGREES = 7;
export const GENERATED_PIN_SPACING_DEGREES = 14;

type PunctureShotRecord = {
  sequence: number;
  roundIndex: number;
  clientActionId: string | null;
  shotAt: number;
  impactAt: number;
  hit: boolean;
  attachedAngle: number | null;
  targetAngle: number;
};

const shotReply = (
  clientActionId: string | null,
  accepted: boolean,
  options: { reason?: string; shot?: PunctureShotRecord } = {},
) => clientActionId ? {
  type: "game.actionResult",
  payload: {
    action: "game.shoot",
    clientActionId,
    accepted,
    ...(options.reason ? { reason: options.reason } : {}),
    ...(options.shot ? { shot: options.shot } : {}),
  },
} : undefined;

const ADVANTAGES = {
  fewer_pins: {
    id: "fewer_pins",
    description: "Start with 20% fewer pins.",
    apply: (requiredPins: number) => Math.floor(requiredPins * 0.8),
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

const seededRandom = (seed: number) => {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
};

const randomInteger = (random: () => number, min: number, max: number) => (
  min + Math.floor(random() * (max - min + 1))
);

export const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;

export const angularDistance = (first: number, second: number) => {
  const distance = Math.abs(normalizeAngle(first) - normalizeAngle(second));
  return Math.min(distance, 360 - distance);
};

export const getRequiredPins = (seed: number) => randomInteger(seededRandom(seed ^ 0x51f15e), 18, 26);

export const getGeneratedPinCount = (seed: number) => randomInteger(seededRandom(seed ^ 0xa11ce), 4, 6);

export const getRotationTurnsPerSecond = (seed: number) => {
  const random = seededRandom(seed ^ 0xc1ac1e);
  const magnitude = 0.28 + (random() * 0.14);
  return (random() < 0.5 ? -1 : 1) * magnitude;
};

export const generateObstacleAngles = (seed: number, count: number): number[] => {
  const random = seededRandom(seed ^ 0x0b57ac1e);
  const angles: number[] = [];
  let attempts = 0;
  while (angles.length < count && attempts < 10_000) {
    attempts += 1;
    const candidate = random() * 360;
    if (angles.every((angle) => angularDistance(angle, candidate) >= GENERATED_PIN_SPACING_DEGREES)) {
      angles.push(candidate);
    }
  }
  if (angles.length !== count) throw new Error("Unable to generate a fair Puncture obstacle layout.");
  return angles.sort((first, second) => first - second);
};

export const generatePunctureRound = (seed: number) => {
  const generatedPinCount = getGeneratedPinCount(seed);
  return {
    requiredPins: getRequiredPins(seed),
    generatedPinCount,
    generatedPinAngles: generateObstacleAngles(seed, generatedPinCount),
    rotationTurnsPerSecond: getRotationTurnsPerSecond(seed),
  };
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
    roundsPlayed: Number(game.state.punctureRoundsPlayed) || 0,
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
};

const startPunctureCountdown = (game: StoredGame, context: GameContext) => {
  const roundIndex = Number(game.state.questionIndex) || 0;
  const seed = hashSeed(`${game.gameId}:${roundIndex}`);
  const round = generatePunctureRound(seed);
  const answers = game.privateState.answersByUserId ?? {};
  const fastestCorrect = game.players
    .map((player) => answers[player.userId])
    .filter((answer: any) => answer?.isCorrect)
    .sort((first: any, second: any) => Number(first.submissionOrder) - Number(second.submissionOrder))[0] ?? null;
  const advantageOwnerUserId = fastestCorrect?.userId ?? null;

  game.state.phase = "puncture_countdown";
  game.state.requiredPins = round.requiredPins;
  game.state.generatedPinCount = round.generatedPinCount;
  game.state.generatedPinAngles = round.generatedPinAngles;
  game.state.rotationTurnsPerSecond = round.rotationTurnsPerSecond;
  game.state.punctureRoundIndex = roundIndex;
  game.state.punctureCountdownStartedAt = context.now + QUESTION_REVEAL_MS;
  game.state.punctureCountdownEndsAt = game.state.punctureCountdownStartedAt + PUNCTURE_COUNTDOWN_MS;
  game.state.phaseDeadlineAt = game.state.punctureCountdownEndsAt;
  game.state.punctureRoundResolvedAt = null;
  game.state.advantageOwnerUserId = advantageOwnerUserId;
  game.state.activeAdvantage = advantageOwnerUserId
    ? { id: ADVANTAGES.fewer_pins.id, description: ADVANTAGES.fewer_pins.description, ownerUserId: advantageOwnerUserId }
    : null;

  game.players.forEach((player) => {
    const hasAdvantage = player.userId === advantageOwnerUserId;
    player.state.pinsRemaining = hasAdvantage
      ? ADVANTAGES.fewer_pins.apply(round.requiredPins)
      : round.requiredPins;
    player.state.puncturePinAngles = [];
    player.state.punctureShotCount = 0;
    player.state.punctureRecentShots = [];
    player.state.stunnedUntil = null;
    player.state.lastShotAt = null;
    player.state.lastClientActionId = null;
    player.state.lastShotHit = false;
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
};

const resolvePunctureRound = (game: StoredGame, winnerUserId: string | null, reason: "target_reached" | "timeout", context: GameContext) => {
  if (game.state.phase !== "puncture_active") return;
  if (winnerUserId) {
    const winner = game.players.find((player) => player.userId === winnerUserId);
    if (winner) winner.state.score = (Number(winner.state.score) || 0) + 1;
  }
  game.state.punctureRoundsPlayed = (Number(game.state.punctureRoundsPlayed) || 0) + 1;
  game.state.punctureRoundResolvedAt = context.now;
  const scoresByUserId = Object.fromEntries(game.players.map((player) => [player.userId, Number(player.state.score) || 0]));
  const remainingByUserId = Object.fromEntries(game.players.map((player) => [player.userId, Number(player.state.pinsRemaining) || 0]));
  const remainingMs = Math.max(0, Number(game.state.punctureRoundDeadlineAt || 0) - context.now);
  game.state.lastPunctureResult = { winnerUserId, reason, scoresByUserId, remainingByUserId, remainingMs };
  context.addEvent("PUNCTURE_ROUND_RESOLVED", {
    roundIndex: game.state.punctureRoundIndex,
    winnerUserId,
    reason,
    scoresByUserId,
    remainingByUserId,
    remainingMs,
  });

  if (winnerUserId && Number(game.players.find((player) => player.userId === winnerUserId)?.state.score) >= SCORE_TO_WIN) {
    beginMatchResult(game, winnerUserId, "first_to_three", context);
    return;
  }
  if (Number(game.state.punctureRoundsPlayed) >= MAX_QUESTIONS) {
    beginMatchResult(game, null, "max_questions", context);
    return;
  }
  game.state.phase = "puncture_result";
  game.state.punctureResultEndsAt = context.now + PUNCTURE_RESULT_MS;
  game.state.phaseDeadlineAt = game.state.punctureResultEndsAt;
};

const publicState = (game: StoredGame) => {
  const questionId = game.state.currentQuestionId;
  const question = game.privateState.questionsById?.[questionId];
  return {
    ...game.state,
    questionsById: questionId && game.state.phase === "question_active"
      ? { [questionId]: sanitizeSatQuestion(question) }
      : {},
    ...(game.state.phase === "finished" ? { reviewQuestionsById: buildReviewQuestionsById(game.privateState.questionsById, game.events) } : {}),
  };
};

export const createPunctureGame = (): GameEngine => ({
  initialize(game, questions, context) {
    const selected = questions.slice(0, MAX_QUESTIONS);
    const ids = selected.map((question) => question.id);
    game.privateState.questionsById = Object.fromEntries(selected.map((question) => [question.id, question]));
    game.state = {
      questionIndex: 0,
      questionIds: ids,
      maxQuestions: MAX_QUESTIONS,
      punctureRoundsPlayed: 0,
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
        startPunctureCountdown(game, context);
      } else {
        game.state.currentQuestionDeadlineAt = Math.min(Number(game.state.currentQuestionDeadlineAt), context.now + POST_SUBMIT_GRACE_MS);
        game.state.phaseDeadlineAt = game.state.currentQuestionDeadlineAt;
      }
      return changedAction();
    }

    if (message.type !== "game.shoot") return unchangedAction();
    const clientActionId = String((message.payload as any)?.clientActionId ?? "").slice(0, 100) || null;
    if (game.state.phase !== "puncture_active") return unchangedAction(shotReply(clientActionId, false, { reason: "phase_closed" }));
    if (context.now >= Number(game.state.punctureRoundDeadlineAt || 0)) return unchangedAction(shotReply(clientActionId, false, { reason: "round_ended" }));
    if (clientActionId) {
      const duplicate = ((player.state.punctureRecentShots as PunctureShotRecord[] | undefined) ?? [])
        .find((shot) => shot.clientActionId === clientActionId);
      if (duplicate) return unchangedAction(shotReply(clientActionId, true, { shot: duplicate }));
      if (player.state.lastClientActionId === clientActionId) {
        return unchangedAction(shotReply(clientActionId, false, { reason: "duplicate" }));
      }
    }
    if (context.now < Number(player.state.stunnedUntil || 0)) return unchangedAction(shotReply(clientActionId, false, { reason: "stunned" }));
    const lastShotAt = Number(player.state.lastShotAt || 0);
    if (lastShotAt && context.now - lastShotAt < MIN_SHOT_INTERVAL_MS) return unchangedAction(shotReply(clientActionId, false, { reason: "rate_limited" }));

    const serverShotAt = context.nowCompensated ?? context.now;
    const clientShotAt = Number((message.payload as any)?.shotAt);
    const shotAt = Number.isFinite(clientShotAt)
      ? Math.min(serverShotAt + CLIENT_SHOT_AT_CLAMP_MS, Math.max(serverShotAt - CLIENT_SHOT_AT_CLAMP_MS, clientShotAt))
      : serverShotAt;
    const shotImpactAt = shotAt + SHOT_TRAVEL_MS;
    const elapsedMs = Math.max(0, shotImpactAt - Number(game.state.punctureRoundStartedAt));
    const rotationDegrees = Number(game.state.rotationTurnsPerSecond) * 360 * (elapsedMs / 1000);
    const attachedAngle = normalizeAngle(SHOT_WORLD_ANGLE - rotationDegrees);
    const existingAngles = [
      ...(game.state.generatedPinAngles ?? []),
      ...((player.state.puncturePinAngles as number[] | undefined) ?? []),
    ];
    const collidedAngle = existingAngles.find((angle) => angularDistance(Number(angle), attachedAngle) <= PUNCTURE_COLLISION_DEGREES);
    const hit = collidedAngle != null;

    player.state.lastShotAt = context.now;
    player.state.lastClientActionId = clientActionId;
    player.state.lastShotHit = hit;
    player.state.punctureShotCount = (Number(player.state.punctureShotCount) || 0) + 1;
    const shot: PunctureShotRecord = {
      sequence: Number(player.state.punctureShotCount),
      roundIndex: Number(game.state.punctureRoundIndex) || 0,
      clientActionId,
      shotAt,
      impactAt: shotImpactAt,
      hit,
      attachedAngle: hit ? null : attachedAngle,
      targetAngle: hit ? Number(collidedAngle) : attachedAngle,
    };
    player.state.punctureRecentShots = [
      ...((player.state.punctureRecentShots as PunctureShotRecord[] | undefined) ?? []),
      shot,
    ].slice(-RECENT_SHOT_LIMIT);
    if (hit) {
      player.state.stunnedUntil = context.now + STUN_MS;
      return changedAction(shotReply(clientActionId, true, { shot }));
    }

    player.state.puncturePinAngles = [
      ...((player.state.puncturePinAngles as number[] | undefined) ?? []),
      attachedAngle,
    ];
    player.state.pinsRemaining = Math.max(0, (Number(player.state.pinsRemaining) || 0) - 1);
    if (Number(player.state.pinsRemaining) <= 0) {
      resolvePunctureRound(game, userId, "target_reached", context);
    }
    return changedAction(shotReply(clientActionId, true, { shot }));
  },
  handleDeadline(game, context) {
    if (game.status !== "active" || context.now < Number(game.state.phaseDeadlineAt || 0)) return;
    if (game.state.phase === "question_active") {
      startPunctureCountdown(game, context);
    } else if (game.state.phase === "puncture_countdown") {
      game.state.phase = "puncture_active";
      game.state.punctureRoundStartedAt = context.now;
      game.state.punctureRoundDeadlineAt = context.now + PUNCTURE_ROUND_MS;
      game.state.phaseDeadlineAt = game.state.punctureRoundDeadlineAt;
    } else if (game.state.phase === "puncture_active") {
      const sorted = [...game.players].sort((first, second) => Number(first.state.pinsRemaining) - Number(second.state.pinsRemaining));
      const winner = Number(sorted[0]?.state.pinsRemaining) < Number(sorted[1]?.state.pinsRemaining) ? sorted[0].userId : null;
      resolvePunctureRound(game, winner, "timeout", context);
    } else if (game.state.phase === "puncture_result") {
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
