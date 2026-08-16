import type { StoredGame } from "../games/contracts";
import { angularDistance, normalizeAngle, PUNCTURE_COLLISION_DEGREES } from "../games/puncture";
import { between, clamp, randomFor } from "./random";
import { humanizedInterval } from "./motion";
import type { BotRuntime, PunctureCrowdingStage } from "./types";

export const getPunctureCrowdingStage = (obstacleCount: number): PunctureCrowdingStage => {
  if (obstacleCount < 10) return "open";
  if (obstacleCount < 17) return "crowded";
  return "precision";
};

export const punctureWouldHit = (game: StoredGame, userId: string, at: number) => {
  const player = game.players.find((p) => p.userId === userId)!;
  const impactAt = at + 75;
  const elapsed = Math.max(0, impactAt - Number(game.state.punctureRoundStartedAt));
  const attached = normalizeAngle(90 - Number(game.state.rotationTurnsPerSecond) * 360 * (elapsed / 1000));
  const angles = [...(game.state.generatedPinAngles ?? []), ...((player.state.puncturePinAngles as number[]) ?? [])];
  return angles.some((angle) => angularDistance(Number(angle), attached) <= PUNCTURE_COLLISION_DEGREES);
};

const findSafeTime = (game: StoredGame, bot: BotRuntime, startAt: number, stage: PunctureCrowdingStage) => {
  const settings = stage === "open"
    ? { initialJitter: 38, candidates: 2, stepMin: 12, stepMax: 34 }
    : stage === "crowded"
      ? { initialJitter: 90, candidates: 4, stepMin: 16, stepMax: 46 }
      : { initialJitter: 150, candidates: 7, stepMin: 18, stepMax: 52 };
  const safeCandidates: number[] = [];
  let candidate = startAt + between(bot, 0, settings.initialJitter);
  for (let attempt = 0; attempt < 150 && safeCandidates.length < settings.candidates; attempt += 1) {
    if (!punctureWouldHit(game, bot.userId, candidate)) safeCandidates.push(candidate);
    candidate += between(bot, settings.stepMin, settings.stepMax);
  }
  if (!safeCandidates.length) return candidate + between(bot, 180, 420);
  return safeCandidates[Math.floor(randomFor(bot) * safeCandidates.length)];
};

export const planPunctureAction = (game: StoredGame, bot: BotRuntime, now: number) => {
  const player = game.players.find((p) => p.userId === bot.userId)!;
  const human = game.players.find((p) => !p.isBot)!;
  const gap = (Number(human?.state.pinsRemaining) || 0) - (Number(player.state.pinsRemaining) || 0);
  const humanProfile = bot.humanProfile.minigame;
  const obstacleCount = (game.state.generatedPinAngles?.length ?? 0)
    + (((player.state.puncturePinAngles as number[] | undefined) ?? []).length);
  const stage = getPunctureCrowdingStage(obstacleCount);
  const stageProfile = humanProfile.puncture;
  const observedForStage = stageProfile.actionsByStage[stage] >= 2 ? stageProfile.intervalMsByStage[stage] : null;
  const observedOverall = humanProfile.actions >= 2 ? humanProfile.intervalEwma : null;
  const naturalBase = stage === "open"
    ? between(bot, 220, 340)
    : stage === "crowded"
      ? between(bot, 290, 510)
      : between(bot, 560, 900);
  // Learn how this particular human plays each density separately. Until there is
  // enough stage-specific evidence, preserve the natural fast-to-careful curve.
  const base = observedForStage != null
    ? naturalBase * 0.18 + observedForStage * 0.82
    : observedOverall != null
      ? naturalBase * 0.38 + observedOverall * 0.62
      : naturalBase;
  // pinsRemaining is inverse progress: a positive gap means the bot is ahead and
  // should ease off, while a negative gap means it should make a bounded catch-up.
  const correction = gap > 0 ? 1 + Math.min(0.3, gap * 0.04) : 1 - Math.min(0.25, -gap * 0.04);
  const timing = stage === "open"
    ? { min: 140, max: 560, variance: 0.14 }
    : stage === "crowded"
      ? { min: 150, max: 820, variance: 0.12 }
      : { min: 300, max: 1_300, variance: 0.08 };
  const interval = humanizedInterval(
    bot, `puncture-${stage}`, base * bot.traits.pace * correction,
    timing.min, timing.max, timing.variance + (1 - bot.traits.consistency) * 0.1,
  );
  const desiredAt = Math.max(now + interval, Number(player.state.stunnedUntil || 0) + between(bot, 50, 180));
  const learnedMistakeRate = humanProfile.accuracyEwma == null ? bot.traits.mistakeRate : 1 - humanProfile.accuracyEwma;
  const lapseChance = clamp((bot.traits.mistakeRate * 0.55) + (learnedMistakeRate * 0.3) + humanProfile.recentMistakeBoost * 0.4, 0.02, 0.18);
  const lapse = randomFor(bot) < lapseChance;
  humanProfile.recentMistakeBoost *= 0.55;
  let at = lapse ? desiredAt : findSafeTime(game, bot, desiredAt, stage);
  // Humans trade speed for control: fast volleys are rougher, while late shots
  // have smaller release error because the player is deliberately lining them up.
  const motorError = stage === "open" ? between(bot, 24, 62) : stage === "crowded" ? between(bot, 14, 42) : between(bot, 5, 20);
  at += (randomFor(bot) + randomFor(bot) - 1) * motorError;
  const correctionChance = stage === "open" ? 0.48 : stage === "crowded" ? 0.72 : 0.88;
  if (!lapse && punctureWouldHit(game, bot.userId, at) && randomFor(bot) < correctionChance) {
    // Most of the time the bot notices a bad release and makes a slightly late correction.
    at = findSafeTime(game, bot, at + between(bot, 70, stage === "precision" ? 330 : 240), stage);
    at += (randomFor(bot) + randomFor(bot) - 1) * between(bot, 5, stage === "precision" ? 14 : 25);
  }
  return { at };
};
