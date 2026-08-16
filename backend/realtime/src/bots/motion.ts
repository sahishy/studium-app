import { between, clamp, randomFor } from "./random";
import type { BotRuntime } from "./types";

/** Correlated tempo plus small motor jitter and rare hesitations. */
export const humanizedInterval = (
  bot: BotRuntime,
  key: string,
  baseMs: number,
  minMs: number,
  maxMs: number,
  variability = 0.1,
) => {
  bot.rhythms ??= {};
  const rhythm = bot.rhythms[key] ??= { multiplier: 1, actionsRemaining: 0 };
  if (rhythm.actionsRemaining <= 0) {
    rhythm.multiplier = between(bot, 0.9, 1.12);
    rhythm.actionsRemaining = Math.floor(between(bot, 3, 8));
  }
  rhythm.actionsRemaining -= 1;
  const triangularJitter = (randomFor(bot) + randomFor(bot) - 1) * variability;
  const hesitation = randomFor(bot) < 0.035 ? between(bot, 1.2, 1.65) : 1;
  return clamp(baseMs * rhythm.multiplier * (1 + triangularJitter) * hesitation, minMs, maxMs);
};
