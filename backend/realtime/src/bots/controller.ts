import { appendChatMessage, sanitizeChatText, type ChatMessage } from "../chat";
import type { GameContext, GameEngine, StoredGame } from "../games/contracts";
import type { RealtimeMessage } from "../types";
import {
  BOT_CHAT_DEBOUNCE_MS,
  BOT_CHAT_JOB_TIMEOUT_MS,
  createBotChatGenerationRequest,
  createInitialBotChatState,
  typingDelayMs,
  type BotChatDispatch,
  type BotChatGenerationRequest,
} from "./chat";
import { planClassicAction } from "./classic";
import { planFlutterAction } from "./flutter";
import { getPunctureCrowdingStage, planPunctureAction } from "./puncture";
import { createBotRuntime, createHumanPerformanceProfile } from "./profile";
import { between } from "./random";
import { planSatAnswer } from "./sat";
import { planTimberAction } from "./timber";
import type { BotRuntime, BotScheduledAction } from "./types";

const runtimes = (game: StoredGame): Record<string, BotRuntime> => (game.privateState.botRuntimes ??= {});
const phaseKey = (game: StoredGame) => `${game.state.phase}:${game.state.currentQuestionId ?? ""}:${game.state.timberRoundIndex ?? game.state.punctureRoundIndex ?? game.state.flutterRoundIndex ?? ""}:${game.state.flutterRingIndex ?? ""}`;

export const initializeBots = (game: StoredGame) => {
  const human = game.players.find((entry) => !entry.isBot);
  for (const player of game.players.filter((entry) => entry.isBot)) {
    const runtime = runtimes(game)[player.userId] ??= createBotRuntime(player, game.gameId, human?.userId ?? "");
    runtime.humanProfile ??= createHumanPerformanceProfile(human?.userId ?? "");
    runtime.humanProfile.minigame.puncture ??= {
      actionsByStage: { open: 0, crowded: 0, precision: 0 },
      intervalMsByStage: { open: null, crowded: null, precision: null },
    };
    // Migrate games persisted before events carried an explicit sequence field, where
    // processedEventCount was an array index into the (then-untrimmed) events array - which
    // numerically equals the old sequence-by-position scheme, so it carries over directly.
    if (runtime.humanProfile.processedEventSequence == null) {
      runtime.humanProfile.processedEventSequence = Number((runtime.humanProfile as any).processedEventCount) || 0;
    }
    runtime.chat ??= createInitialBotChatState();
    runtime.rhythms ??= {};
  }
};

const updateEwma = (current: number | null, value: number, weight: number) => (
  current == null ? value : current * (1 - weight) + value * weight
);

const recordQuestion = (game: StoredGame, bot: BotRuntime, questionId: string, correct: boolean, elapsedMs: number | null) => {
  const profile = bot.humanProfile.questions;
  if (!questionId || profile.questionIds.includes(questionId)) return;
  profile.questionIds.push(questionId);
  profile.answers += 1;
  profile.correct += Number(correct);
  profile.accuracyEwma = updateEwma(profile.accuracyEwma, Number(correct), 0.4);
  if (elapsedMs != null && Number.isFinite(elapsedMs)) {
    profile.answerMsEwma = updateEwma(profile.answerMsEwma, elapsedMs, 0.45);
    const question = game.privateState.questionsById?.[questionId];
    const difficulty = (["Easy", "Medium", "Hard"].includes(question?.difficulty) ? question.difficulty : "Medium") as "Easy" | "Medium" | "Hard";
    profile.answerMsByDifficulty[difficulty] = updateEwma(profile.answerMsByDifficulty[difficulty], elapsedMs, 0.55);
  }
};

const ingestResolvedEvents = (game: StoredGame, bot: BotRuntime) => {
  const human = game.players.find((entry) => !entry.isBot);
  if (!human) return;
  // Filtered by sequence, not sliced by array index: the persisted event log is trimmed
  // (see GameServer.save), so an array index recorded before a trim would silently point at the
  // wrong events - or skip/reprocess them - after a hibernation wake reloads the trimmed array.
  const processedSequence = Number(bot.humanProfile.processedEventSequence) || 0;
  const events = game.events.filter((event) => Number(event.sequence) > processedSequence);
  for (const event of events) {
    if (event.type === "QUESTION_RESOLVED" || event.type === "ROUND_RESOLVED") {
      const result = (event.data?.roundResults ?? []).find((entry: any) => entry.userId === human.userId);
      recordQuestion(game, bot, String(event.data?.questionId ?? ""), Boolean(result?.isCorrect), Number.isFinite(Number(result?.elapsedMs)) ? Number(result.elapsedMs) : null);
    }
    if (["TIMBER_ROUND_RESOLVED", "PUNCTURE_ROUND_RESOLVED", "FLUTTER_ROUND_RESOLVED"].includes(event.type)) {
      bot.humanProfile.minigame.roundsCompleted += 1;
    }
    if (event.type === "FLUTTER_ROUND_RESOLVED") {
      const success = event.data?.winnerUserId === human.userId ? 1 : 0;
      const minigame = bot.humanProfile.minigame;
      minigame.actions += 1;
      minigame.successes += success;
      minigame.mistakes += 1 - success;
      minigame.accuracyEwma = updateEwma(minigame.accuracyEwma, success, 0.5);
    }
  }
  bot.humanProfile.processedEventSequence = Math.max(processedSequence, ...events.map((event) => Number(event.sequence) || 0));
};

const enqueue = (bot: BotRuntime, action: Omit<BotScheduledAction, "id">) => {
  bot.sequence += 1;
  bot.scheduled.push({ ...action, id: `${bot.userId}:${bot.sequence}` });
  bot.scheduled.sort((a, b) => a.at - b.at);
};

const hasPhaseAction = (bot: BotRuntime, key: string) => bot.scheduled.some((action) => action.kind === "game" && action.phaseKey === key);

export const ensureBotActions = (game: StoredGame, now: number) => {
  initializeBots(game);
  if (game.status !== "active") {
    for (const bot of Object.values(runtimes(game))) {
      bot.scheduled = bot.scheduled.filter((action) => action.kind !== "chat_send");
      bot.chat.pending = null;
    }
    return;
  }
  for (const bot of Object.values(runtimes(game))) ingestResolvedEvents(game, bot);
  const key = phaseKey(game);
  for (const bot of Object.values(runtimes(game))) {
    bot.scheduled = bot.scheduled.filter((action) => action.kind === "chat_send" || action.phaseKey === key);
    if (hasPhaseAction(bot, key)) continue;
    let planned: { at: number; message: RealtimeMessage } | null = null;
    if (game.state.phase === "question_active") {
      const currentQuestionId = String(game.state.currentQuestionId ?? "");
      if (bot.skippedQuestionId === currentQuestionId) continue;
      const answer = game.modeId === "sat-classic" ? planClassicAction(game, bot, now) : planSatAnswer(game, bot, now);
      if (answer) planned = { at: answer.at, message: { id: `bot-answer-${bot.sequence}`, type: "game.answer", payload: { submittedResponse: answer.response } } };
    } else if (game.state.phase === "timber_active") {
      const action = planTimberAction(game, bot, now);
      planned = { at: action.at, message: { id: `bot-chop-${bot.sequence}`, type: "game.chop", payload: { side: action.side } } };
    } else if (game.state.phase === "puncture_active") {
      const action = planPunctureAction(game, bot, now);
      planned = { at: action.at, message: { id: `bot-shot-${bot.sequence}`, type: "game.shoot", payload: {} } };
    } else if (game.state.phase === "flutter_active") {
      const action = planFlutterAction(game, bot, now);
      planned = { at: action.at, message: { id: `bot-flight-${bot.sequence}`, type: "game.flutterInput", payload: action.payload } };
    }
    if (planned) enqueue(bot, { ...planned, phaseKey: key, kind: "game" });
  }
};

export const nextBotDeadline = (game: StoredGame) => {
  const deadlines = Object.values(runtimes(game)).flatMap((bot) => bot.scheduled.map((action) => action.at));
  return deadlines.length ? Math.min(...deadlines) : null;
};

const earliestScheduled = (game: StoredGame) => Object.values(runtimes(game))
  .flatMap((bot) => bot.scheduled.map((action) => ({ bot, action })))
  .sort((first, second) => first.action.at - second.action.at)[0] ?? null;

/**
 * Discards the earliest pending gameplay action *without* executing it, then re-plans from
 * `planFrom`. Used when a tick ran so late that executing the backlog would fast-forward
 * player-visible gameplay (a bot appearing to gain 40 chops instantly). Returns false when the
 * earliest action is a chat send - those are harmless to deliver late, so the caller runs them.
 */
export const dropNextBotGameAction = (game: StoredGame, planFrom: number) => {
  const next = earliestScheduled(game);
  if (!next || next.action.kind !== "game") return false;
  next.bot.scheduled = next.bot.scheduled.filter((action) => action.id !== next.action.id);
  ensureBotActions(game, planFrom);
  return true;
};

/**
 * `context.now` is when the action is simulated as happening (kept exact, because bot planners
 * pick times whose world state is favourable - e.g. Puncture's wheel angle). `planFrom` is the
 * clock the *next* action is scheduled from, and must be real "now" so a late tick cannot chain
 * a backlog of already-due actions.
 */
export const runNextBotAction = (game: StoredGame, engine: GameEngine, context: GameContext, planFrom = context.now) => {
  const next = earliestScheduled(game);
  if (!next || next.action.at > context.now) return false;
  next.bot.scheduled = next.bot.scheduled.filter((action) => action.id !== next.action.id);
  const identity = game.players.find((player) => player.userId === next.bot.userId);
  if (!identity) return false;
  if (next.action.kind === "chat_send") {
    const pending = next.bot.chat.pending;
    if (game.status !== "active" || !pending || pending.id !== next.action.chatJobId || pending.status !== "typing") {
      ensureBotActions(game, planFrom);
      return true;
    }
    const beforeLastUid = (game.chat.at(-1) as ChatMessage | undefined)?.uid;
    game.chat = appendChatMessage(game.chat as ChatMessage[], identity, { text: next.action.text });
    const appended = game.chat.at(-1) as ChatMessage | undefined;
    if (appended?.uid && appended.uid !== beforeLastUid) {
      next.bot.chat.sentCount += 1;
      next.bot.chat.lastBotMessageUid = appended.uid;
    }
    next.bot.chat.humanMessagesSinceReply = 0;
    next.bot.chat.nextResponseAfter = next.bot.chat.sentCount >= 10 ? Math.floor(between(next.bot, 3, 7)) : 1;
    next.bot.chat.pending = null;
  } else if (next.action.message) {
    engine.handleAction(game, next.bot.userId, next.action.message, context);
  }
  ensureBotActions(game, planFrom);
  return true;
};

export const observeHumanAction = (game: StoredGame, userId: string, message: RealtimeMessage, now: number, before: Record<string, unknown>) => {
  const player = game.players.find((entry) => entry.userId === userId);
  if (!player || player.isBot) return;
  let accepted = false;
  let mistake = false;
  if (message.type === "game.answer") accepted = JSON.stringify(before.answeredQuestionIds) !== JSON.stringify(player.state.answeredQuestionIds);
  if (message.type === "game.chop") {
    accepted = Number(before.timberActualChops) !== Number(player.state.timberActualChops);
    mistake = accepted && Number(player.state.stunnedUntil) > now;
  }
  if (message.type === "game.shoot") {
    accepted = Number(before.punctureShotCount) !== Number(player.state.punctureShotCount);
    mistake = accepted && Boolean(player.state.lastShotHit);
  }
  if (!accepted) return;
  for (const bot of Object.values(runtimes(game))) {
    if (message.type === "game.answer") {
      const beforeIds = new Set(Array.isArray(before.answeredQuestionIds) ? before.answeredQuestionIds as string[] : []);
      const questionId = ((player.state.answeredQuestionIds as string[] | undefined) ?? []).find((id) => !beforeIds.has(id))
        ?? String(game.state.currentQuestionId ?? "");
      const storedAnswer = game.privateState.answersByUserId?.[userId]
        ?? player.state.lastAnswer
        ?? [...game.events].reverse().find((event) => event.type === "QUESTION_RESOLVED" || event.type === "ROUND_RESOLVED")?.data?.roundResults?.find((entry: any) => entry.userId === userId);
      recordQuestion(game, bot, questionId, Boolean(storedAnswer?.isCorrect), Number.isFinite(Number(storedAnswer?.elapsedMs)) ? Number(storedAnswer.elapsedMs) : null);
    } else {
      const minigame = bot.humanProfile.minigame;
      const roundKey = String(game.state.timberRoundIndex ?? game.state.punctureRoundIndex ?? game.state.flutterRoundIndex ?? "");
      const interval = minigame.lastActionAt != null && minigame.lastRoundKey === roundKey
        ? now - minigame.lastActionAt
        : null;
      if (minigame.lastActionAt != null && minigame.lastRoundKey === roundKey) {
        const latestActionWeight = game.modeId === "sat-timber" || game.modeId === "sat-puncture" ? 0.7 : 0.25;
        minigame.intervalEwma = updateEwma(minigame.intervalEwma, interval!, latestActionWeight);
      }
      if (game.modeId === "sat-puncture" && message.type === "game.shoot") {
        const obstacleCount = (game.state.generatedPinAngles?.length ?? 0)
          + (Array.isArray(before.puncturePinAngles) ? before.puncturePinAngles.length : 0);
        const stage = getPunctureCrowdingStage(obstacleCount);
        const puncture = minigame.puncture;
        puncture.actionsByStage[stage] += 1;
        if (interval != null) {
          puncture.intervalMsByStage[stage] = updateEwma(puncture.intervalMsByStage[stage], interval, 0.72);
        }
      }
      minigame.lastActionAt = now;
      minigame.lastRoundKey = roundKey;
      minigame.actions += 1;
      minigame.successes += Number(!mistake);
      minigame.mistakes += Number(mistake);
      minigame.accuracyEwma = updateEwma(minigame.accuracyEwma, Number(!mistake), game.modeId === "sat-timber" ? 0.55 : 0.35);
      if (mistake) minigame.recentMistakeBoost = Math.max(minigame.recentMistakeBoost, 0.16 + between(bot, 0, 0.18));
    }
    if (message.type === "game.answer") {
      const pending = bot.scheduled.find((action) => action.kind === "game" && action.message?.type === "game.answer");
      if (pending) {
        const botWasReady = pending.at <= now;
        const shouldRespond = between(bot, 0, 1) < (botWasReady ? 0.82 : 0.62);
        if (shouldRespond) {
          // A human submission always starts a fresh, visible reaction window. This
          // also fixes overdue alarm actions appearing to answer instantaneously.
          pending.at = now + between(bot, 3_000, 7_000);
          bot.scheduled.sort((first, second) => first.at - second.at);
        } else {
          bot.scheduled = bot.scheduled.filter((action) => action.id !== pending.id);
          bot.skippedQuestionId = String(game.state.currentQuestionId ?? "");
        }
      }
    }
  }
};

const resetChatCadenceAfterAttempt = (bot: BotRuntime) => {
  bot.chat.humanMessagesSinceReply = 0;
  bot.chat.nextResponseAfter = bot.chat.sentCount >= 10 ? Math.floor(between(bot, 3, 7)) : 1;
};

export const scheduleBotChatReply = (game: StoredGame, message: ChatMessage, now: number): BotChatDispatch[] => {
  if (game.status !== "active" || !message.uid || message.system || !message.userId) return [];
  initializeBots(game);
  const dispatches: BotChatDispatch[] = [];
  for (const bot of Object.values(runtimes(game))) {
    if (message.userId === bot.userId || bot.chat.lastObservedHumanMessageUid === message.uid) continue;
    bot.chat.lastObservedHumanMessageUid = message.uid;
    if (bot.chat.sentCount >= 20) continue;
    bot.chat.humanMessagesSinceReply += 1;
    if (bot.chat.pending) {
      bot.chat.pending.sourceThroughMessageUid = message.uid;
      if (bot.chat.pending.status === "debouncing") {
        bot.chat.pending.revision += 1;
        bot.chat.pending.debounceAt = now + BOT_CHAT_DEBOUNCE_MS;
        bot.chat.pending.expiresAt = bot.chat.pending.debounceAt + BOT_CHAT_JOB_TIMEOUT_MS;
        dispatches.push({
          gameId: game.gameId,
          botUserId: bot.userId,
          jobId: bot.chat.pending.id,
          revision: bot.chat.pending.revision,
          dueAt: bot.chat.pending.debounceAt,
        });
      }
      continue;
    }
    const threshold = bot.chat.sentCount < 10 ? 1 : bot.chat.nextResponseAfter;
    if (bot.chat.humanMessagesSinceReply < threshold) continue;
    const id = crypto.randomUUID();
    bot.chat.pending = {
      id,
      revision: 1,
      status: "debouncing",
      debounceAt: now + BOT_CHAT_DEBOUNCE_MS,
      expiresAt: now + BOT_CHAT_DEBOUNCE_MS + BOT_CHAT_JOB_TIMEOUT_MS,
      sourceThroughMessageUid: message.uid,
    };
    dispatches.push({ gameId: game.gameId, botUserId: bot.userId, jobId: id, revision: 1, dueAt: now + BOT_CHAT_DEBOUNCE_MS });
  }
  return dispatches;
};

export const beginBotChatGeneration = (
  game: StoredGame,
  botUserId: string,
  jobId: string,
  revision: number,
  now: number,
): { request?: BotChatGenerationRequest; retryAt?: number } | null => {
  if (game.status !== "active") return null;
  initializeBots(game);
  const bot = runtimes(game)[botUserId];
  const pending = bot?.chat.pending;
  if (!bot || !pending || pending.id !== jobId || pending.revision !== revision || pending.status !== "debouncing") return null;
  if (now < pending.debounceAt) return { retryAt: pending.debounceAt };
  const request = createBotChatGenerationRequest(game, bot);
  if (!request) {
    resetChatCadenceAfterAttempt(bot);
    bot.chat.pending = null;
    return null;
  }
  pending.status = "generating";
  pending.generationStartedAt = now;
  pending.expiresAt = now + BOT_CHAT_JOB_TIMEOUT_MS;
  return { request };
};

export const completeBotChatGeneration = (
  game: StoredGame,
  botUserId: string,
  jobId: string,
  revision: number,
  text: string,
  now: number,
) => {
  if (game.status !== "active") return false;
  initializeBots(game);
  const bot = runtimes(game)[botUserId];
  const pending = bot?.chat.pending;
  const sanitizedText = sanitizeChatText(text);
  const delay = typingDelayMs(sanitizedText);
  if (!bot || !pending || pending.id !== jobId || pending.revision !== revision || pending.status !== "generating" || !delay) return false;
  pending.status = "typing";
  pending.expiresAt = now + delay + 10_000;
  enqueue(bot, { at: now + delay, phaseKey: phaseKey(game), kind: "chat_send", text: sanitizedText, chatJobId: jobId });
  return true;
};

export const failBotChatGeneration = (game: StoredGame, botUserId: string, jobId: string, revision: number) => {
  initializeBots(game);
  const bot = runtimes(game)[botUserId];
  const pending = bot?.chat.pending;
  if (!bot || !pending || pending.id !== jobId || pending.revision !== revision) return false;
  bot.scheduled = bot.scheduled.filter((action) => action.chatJobId !== jobId);
  resetChatCadenceAfterAttempt(bot);
  bot.chat.pending = null;
  return true;
};

export const nextBotChatExpiry = (game: StoredGame) => {
  const deadlines = Object.values(runtimes(game)).map((bot) => bot.chat?.pending?.expiresAt).filter((value): value is number => Number.isFinite(value));
  return deadlines.length ? Math.min(...deadlines) : null;
};

export const expireBotChatJobs = (game: StoredGame, now: number) => {
  let changed = false;
  initializeBots(game);
  for (const bot of Object.values(runtimes(game))) {
    const pending = bot.chat.pending;
    if (!pending || now < pending.expiresAt) continue;
    bot.scheduled = bot.scheduled.filter((action) => action.chatJobId !== pending.id);
    resetChatCadenceAfterAttempt(bot);
    bot.chat.pending = null;
    changed = true;
  }
  return changed;
};
