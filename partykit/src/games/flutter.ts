import type { GameContext, GameEngine, StoredGame } from "./contracts";
import { isCorrectSatAnswer, sanitizeSatQuestion } from "./sat-questions";

const MAX_QUESTIONS = 10;
const SCORE_TO_WIN = 3;
const QUESTION_COUNTDOWN_MS = 3_000;
const QUESTION_MS = 120_000;
const POST_SUBMIT_GRACE_MS = 16_000;
const QUESTION_REVEAL_MS = 2_000;
const FLUTTER_COUNTDOWN_MS = 3_000;
const FLUTTER_RESULT_MS = 3_000;
const MATCH_RESULT_MS = 3_000;
const FIRST_RING_DELAY_MS = 2_600;
const BASE_RING_INTERVAL_MS = 2_200;
const MIN_RING_INTERVAL_MS = 650;
const RING_ACCELERATION_MS = 135;
const VISIBLE_RING_COUNT = 8;
const RING_SPACING = 15;
const FLIGHT_ACCELERATION = 10;

export const FLUTTER_BOUNDS = { x: 5.2, y: 3.15 } as const;
export const FLUTTER_MAX_SPEED = 6.4;
// The avatar mesh is posed lengthwise through the ring, so its clearance profile
// at the ring plane is substantially smaller than its full rendered silhouette.
export const FLUTTER_AVATAR_RADIUS = 0.4;
export const FLUTTER_RING_INNER_RADIUS = 2.05;

type FlutterInput = { up: boolean; down: boolean; left: boolean; right: boolean };
export type FlutterRing = { index: number; x: number; y: number; innerRadius: number; passAt: number; speed: number };

const EMPTY_INPUT: FlutterInput = { up: false, down: false, left: false, right: false };

export const hashFlutterSeed = (value: string) => {
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

export const getFlutterRingIntervalMs = (ringIndex: number) => (
  Math.max(MIN_RING_INTERVAL_MS, BASE_RING_INTERVAL_MS - (Math.max(0, ringIndex) * RING_ACCELERATION_MS))
);

export const generateFlutterRingCenters = (seed: number, count: number): Array<{ x: number; y: number }> => {
  const random = seededRandom(seed);
  let x = 0;
  let y = 0;
  return Array.from({ length: count }, (_, index) => {
    if (index > 0) {
      const variationProgress = Math.min(1, index / 18);
      const horizontalRange = 2.7 + (variationProgress * 1.45);
      const verticalRange = 1.55 + (variationProgress * 0.85);
      const maxStep = 0.78 + (variationProgress * 0.92);
      x = Math.max(-horizontalRange, Math.min(horizontalRange, x + ((random() * 2 - 1) * maxStep)));
      y = Math.max(-verticalRange, Math.min(verticalRange, y + ((random() * 2 - 1) * maxStep * 0.78)));
    }
    return { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) };
  });
};

export const integrateFlutterMotion = (state: {
  x: number; y: number; velocityX: number; velocityY: number; input: FlutterInput;
}, elapsedMs: number) => {
  let remaining = Math.max(0, Number(elapsedMs) || 0) / 1000;
  let { x, y, velocityX, velocityY } = state;
  const horizontal = Number(state.input.right) - Number(state.input.left);
  const vertical = Number(state.input.up) - Number(state.input.down);
  const magnitude = Math.hypot(horizontal, vertical) || 1;
  const targetX = (horizontal / magnitude) * FLUTTER_MAX_SPEED;
  const targetY = (vertical / magnitude) * FLUTTER_MAX_SPEED;

  while (remaining > 0) {
    const step = Math.min(1 / 60, remaining);
    const blend = 1 - Math.exp(-FLIGHT_ACCELERATION * step);
    velocityX += (targetX - velocityX) * blend;
    velocityY += (targetY - velocityY) * blend;
    x += velocityX * step;
    y += velocityY * step;
    if (x <= -FLUTTER_BOUNDS.x || x >= FLUTTER_BOUNDS.x) velocityX = 0;
    if (y <= -FLUTTER_BOUNDS.y || y >= FLUTTER_BOUNDS.y) velocityY = 0;
    x = Math.max(-FLUTTER_BOUNDS.x, Math.min(FLUTTER_BOUNDS.x, x));
    y = Math.max(-FLUTTER_BOUNDS.y, Math.min(FLUTTER_BOUNDS.y, y));
    remaining -= step;
  }

  return { x, y, velocityX, velocityY };
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
    roundsPlayed: Number(game.state.flutterRoundsPlayed) || 0,
    endReason,
    startedAt: game.startedAt,
    endedAt: context.now,
  };
  context.addEvent("GAME_ENDED", { winnerUserId, endReason, eloDeltaByUserId: {} });
};

const beginMatchResult = (game: StoredGame, winnerUserId: string, context: GameContext) => {
  game.state.phase = "match_result";
  game.state.matchResultWinnerUserId = winnerUserId;
  game.state.matchResultEndReason = "first_to_three";
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
  game.players.forEach((player) => { player.state.answeredQuestionIds = []; });
  context.addEvent("QUESTION_STARTED", { questionIndex: index, questionId });
};

const resetFlightPlayer = (player: StoredGame["players"][number], at: number) => {
  player.state.flutterX = 0;
  player.state.flutterY = 0;
  player.state.flutterVelocityX = 0;
  player.state.flutterVelocityY = 0;
  player.state.flutterInput = { ...EMPTY_INPUT };
  player.state.flutterInputSequence = -1;
  player.state.flutterLastUpdatedAt = at;
  player.state.flutterRingsCleared = 0;
};

const startFlutterCountdown = (game: StoredGame, context: GameContext, retry = false) => {
  const roundIndex = Number(game.state.questionIndex) || 0;
  const answers = game.privateState.answersByUserId ?? {};
  const fastestCorrect = game.players
    .map((player) => answers[player.userId])
    .filter((answer: any) => answer?.isCorrect)
    .sort((a: any, b: any) => Number(a.submissionOrder) - Number(b.submissionOrder))[0] ?? null;
  const advantageOwnerUserId = fastestCorrect?.userId ?? null;
  const attempt = retry ? (Number(game.state.flutterAttempt) || 0) + 1 : 0;
  const shieldOwnerUserId = retry
    ? game.players.find((player) => player.state.flutterShieldAvailable)?.userId ?? null
    : advantageOwnerUserId;

  game.state.phase = "flutter_countdown";
  game.state.flutterRoundIndex = roundIndex;
  game.state.flutterAttempt = attempt;
  game.state.flutterSeed = hashFlutterSeed(`${game.gameId}:${roundIndex}:${attempt}`);
  game.state.flutterCountdownStartedAt = context.now + (retry ? 0 : QUESTION_REVEAL_MS);
  game.state.flutterCountdownEndsAt = game.state.flutterCountdownStartedAt + FLUTTER_COUNTDOWN_MS;
  game.state.phaseDeadlineAt = game.state.flutterCountdownEndsAt;
  game.state.advantageOwnerUserId = shieldOwnerUserId;
  game.state.activeAdvantage = shieldOwnerUserId
    ? { id: "one_time_shield", description: "Survive one missed ring.", ownerUserId: shieldOwnerUserId }
    : null;

  game.players.forEach((player) => {
    resetFlightPlayer(player, game.state.flutterCountdownEndsAt);
    if (!retry) player.state.flutterShieldAvailable = player.userId === advantageOwnerUserId;
  });

  if (!retry) {
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
  }
  context.addEvent("FLUTTER_COUNTDOWN_STARTED", { roundIndex, attempt, advantageOwnerUserId: shieldOwnerUserId, advantage: game.state.activeAdvantage });
};

const integratePlayerTo = (player: StoredGame["players"][number], at: number) => {
  const lastUpdatedAt = Number(player.state.flutterLastUpdatedAt) || at;
  const next = integrateFlutterMotion({
    x: Number(player.state.flutterX) || 0,
    y: Number(player.state.flutterY) || 0,
    velocityX: Number(player.state.flutterVelocityX) || 0,
    velocityY: Number(player.state.flutterVelocityY) || 0,
    input: (player.state.flutterInput as FlutterInput | undefined) ?? EMPTY_INPUT,
  }, Math.max(0, at - lastUpdatedAt));
  player.state.flutterX = next.x;
  player.state.flutterY = next.y;
  player.state.flutterVelocityX = next.velocityX;
  player.state.flutterVelocityY = next.velocityY;
  player.state.flutterLastUpdatedAt = at;
};

const ringCenter = (game: StoredGame, index: number) => generateFlutterRingCenters(Number(game.state.flutterSeed), index + 1)[index];

const clearsRing = (player: StoredGame["players"][number], center: { x: number; y: number }) => (
  Math.hypot(Number(player.state.flutterX) - center.x, Number(player.state.flutterY) - center.y) + FLUTTER_AVATAR_RADIUS <= FLUTTER_RING_INNER_RADIUS
);

const resolveFlutterRound = (game: StoredGame, winnerUserId: string | null, reason: "miss" | "simultaneous_miss", context: GameContext) => {
  if (winnerUserId) {
    const winner = game.players.find((player) => player.userId === winnerUserId);
    if (winner) winner.state.score = (Number(winner.state.score) || 0) + 1;
    game.state.flutterRoundsPlayed = (Number(game.state.flutterRoundsPlayed) || 0) + 1;
  }
  const scoresByUserId = Object.fromEntries(game.players.map((player) => [player.userId, Number(player.state.score) || 0]));
  const ringsClearedByUserId = Object.fromEntries(game.players.map((player) => [player.userId, Number(player.state.flutterRingsCleared) || 0]));
  game.state.flutterRoundResolvedAt = context.now;
  game.state.lastFlutterResult = { winnerUserId, reason, scoresByUserId, ringsClearedByUserId, retry: !winnerUserId };
  context.addEvent("FLUTTER_ROUND_RESOLVED", {
    roundIndex: game.state.flutterRoundIndex,
    attempt: game.state.flutterAttempt,
    winnerUserId,
    reason,
    scoresByUserId,
    ringsClearedByUserId,
  });

  if (winnerUserId && Number(game.players.find((player) => player.userId === winnerUserId)?.state.score) >= SCORE_TO_WIN) {
    beginMatchResult(game, winnerUserId, context);
    return;
  }
  game.state.phase = "flutter_result";
  game.state.flutterResultEndsAt = context.now + FLUTTER_RESULT_MS;
  game.state.phaseDeadlineAt = game.state.flutterResultEndsAt;
};

const passCurrentRing = (game: StoredGame, context: GameContext) => {
  const passAt = Number(game.state.flutterCurrentRingPassAt) || context.now;
  game.players.forEach((player) => integratePlayerTo(player, passAt));
  const index = Number(game.state.flutterRingIndex) || 0;
  const center = ringCenter(game, index);
  const missed = game.players.filter((player) => !clearsRing(player, center));
  const unprotectedMisses = missed.filter((player) => {
    if (!player.state.flutterShieldAvailable) return true;
    player.state.flutterShieldAvailable = false;
    context.addEvent("FLUTTER_SHIELD_CONSUMED", { roundIndex: game.state.flutterRoundIndex, attempt: game.state.flutterAttempt, ringIndex: index }, player.userId);
    return false;
  });

  if (unprotectedMisses.length) {
    const survivors = game.players.filter((player) => !unprotectedMisses.includes(player));
    resolveFlutterRound(game, unprotectedMisses.length === 1 ? survivors[0]?.userId ?? null : null, unprotectedMisses.length === 1 ? "miss" : "simultaneous_miss", context);
    return;
  }

  game.players.forEach((player) => { player.state.flutterRingsCleared = index + 1; });
  const nextIndex = index + 1;
  game.state.flutterRingIndex = nextIndex;
  game.state.flutterAccelerationProgress = nextIndex;
  game.state.flutterCurrentRingPassAt = passAt + getFlutterRingIntervalMs(nextIndex);
  game.state.phaseDeadlineAt = game.state.flutterCurrentRingPassAt;
};

const visibleRings = (game: StoredGame): FlutterRing[] => {
  const startIndex = Number(game.state.flutterRingIndex) || 0;
  let passAt = Number(game.state.flutterCurrentRingPassAt) || 0;
  const centers = generateFlutterRingCenters(Number(game.state.flutterSeed), startIndex + VISIBLE_RING_COUNT);
  return Array.from({ length: VISIBLE_RING_COUNT }, (_, offset) => {
    const index = startIndex + offset;
    if (offset > 0) passAt += getFlutterRingIntervalMs(index);
    const interval = index === 0 ? FIRST_RING_DELAY_MS : getFlutterRingIntervalMs(index);
    return { index, ...centers[index], innerRadius: FLUTTER_RING_INNER_RADIUS, passAt, speed: RING_SPACING / (interval / 1000) };
  });
};

const publicState = (game: StoredGame) => {
  const questionId = game.state.currentQuestionId;
  const question = game.privateState.questionsById?.[questionId];
  return {
    ...game.state,
    questionsById: questionId && game.state.phase === "question_active" ? { [questionId]: sanitizeSatQuestion(question) } : {},
    visibleFlutterRings: game.state.phase === "flutter_active" || game.state.phase === "flutter_result" ? visibleRings(game) : [],
  };
};

export const createFlutterGame = (): GameEngine => ({
  initialize(game, questions, context) {
    const selected = questions.slice(0, MAX_QUESTIONS);
    const ids = selected.map((question) => question.id);
    game.privateState.questionsById = Object.fromEntries(selected.map((question) => [question.id, question]));
    game.state = { questionIndex: 0, questionIds: ids, maxQuestions: MAX_QUESTIONS, flutterRoundsPlayed: 0, winnerUserId: null, startedAt: context.now };
    game.players.forEach((player) => { player.state = { score: 0, answeredQuestionIds: [], flutterShieldAvailable: false }; });
    startQuestion(game, context);
    context.addEvent("GAME_STARTED", { questionId: ids[0] ?? null });
  },
  handleAction(game, userId, message, context) {
    if (game.status !== "active") return;
    const player = game.players.find((entry) => entry.userId === userId);
    if (!player) return;

    if (message.type === "game.answer" && game.state.phase === "question_active") {
      if (context.now < Number(game.state.currentQuestionActiveAt || 0) || context.now >= Number(game.state.currentQuestionDeadlineAt || 0)) return;
      const questionId = game.state.currentQuestionId;
      const question = game.privateState.questionsById?.[questionId];
      const response = String((message.payload as any)?.submittedResponse ?? "").trim();
      if (!question || !response || (player.state.answeredQuestionIds as string[]).includes(questionId)) return;
      game.privateState.answerSequence = Number(game.privateState.answerSequence || 0) + 1;
      game.privateState.answersByUserId[userId] = {
        userId, questionId, submittedResponse: response,
        elapsedMs: Math.max(0, context.now - Number(game.state.currentQuestionActiveAt)),
        submittedAt: context.now, submissionOrder: game.privateState.answerSequence,
        isCorrect: isCorrectSatAnswer(question, response),
      };
      player.state.answeredQuestionIds = [questionId];
      context.addEvent("ANSWER_SUBMITTED", { questionId }, userId);
      if (game.players.every((entry) => (entry.state.answeredQuestionIds as string[]).includes(questionId))) startFlutterCountdown(game, context);
      else {
        game.state.currentQuestionDeadlineAt = Math.min(Number(game.state.currentQuestionDeadlineAt), context.now + POST_SUBMIT_GRACE_MS);
        game.state.phaseDeadlineAt = game.state.currentQuestionDeadlineAt;
      }
      return;
    }

    if (message.type !== "game.flutterInput" || game.state.phase !== "flutter_active") return;
    const payload = (message.payload ?? {}) as Record<string, unknown>;
    const sequence = Number(payload.sequence);
    if (!Number.isSafeInteger(sequence) || sequence <= Number(player.state.flutterInputSequence ?? -1)) return;
    if ([payload.up, payload.down, payload.left, payload.right].some((value) => typeof value !== "boolean")) return;
    integratePlayerTo(player, context.now);
    player.state.flutterInputSequence = sequence;
    player.state.flutterInput = {
      up: payload.up as boolean,
      down: payload.down as boolean,
      left: payload.left as boolean,
      right: payload.right as boolean,
    };
  },
  handleDeadline(game, context) {
    if (game.status !== "active" || context.now < Number(game.state.phaseDeadlineAt || 0)) return;
    if (game.state.phase === "question_active") startFlutterCountdown(game, context);
    else if (game.state.phase === "flutter_countdown") {
      game.state.phase = "flutter_active";
      game.state.flutterRoundStartedAt = context.now;
      game.state.flutterRingIndex = 0;
      game.state.flutterAccelerationProgress = 0;
      game.state.flutterCurrentRingPassAt = context.now + FIRST_RING_DELAY_MS;
      game.state.phaseDeadlineAt = game.state.flutterCurrentRingPassAt;
      game.players.forEach((player) => resetFlightPlayer(player, context.now));
      context.addEvent("FLUTTER_ROUND_STARTED", { roundIndex: game.state.flutterRoundIndex, attempt: game.state.flutterAttempt });
    } else if (game.state.phase === "flutter_active") passCurrentRing(game, context);
    else if (game.state.phase === "flutter_result") {
      if (game.state.lastFlutterResult?.retry) startFlutterCountdown(game, context, true);
      else {
        game.state.questionIndex = Number(game.state.questionIndex) + 1;
        startQuestion(game, context);
      }
    } else if (game.state.phase === "match_result") finish(game, game.state.matchResultWinnerUserId ?? null, "first_to_three", context);
  },
  publicState,
  nextDeadline(game) { return game.status === "active" ? Number(game.state.phaseDeadlineAt || 0) || null : null; },
  handleForfeit(game, leaverUserId, context) {
    if (game.state.phase === "match_result") {
      finish(game, game.state.matchResultWinnerUserId ?? null, "first_to_three", context);
      return;
    }
    const winner = game.players.find((player) => player.userId !== leaverUserId)?.userId ?? null;
    finish(game, winner, "player_left", context);
  },
});
