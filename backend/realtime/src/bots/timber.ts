import type { StoredGame } from "../games/contracts";
import { between, clamp, randomFor } from "./random";
import { humanizedInterval } from "./motion";
import type { BotRuntime } from "./types";

export const planTimberAction = (game: StoredGame, bot: BotRuntime, now: number) => {
  const player = game.players.find((p) => p.userId === bot.userId)!;
  const human = game.players.find((p) => !p.isBot)!;
  const actual = Number(player.state.timberActualChops) || 0;
  const branch = (game.privateState.branchSequence ?? [])[actual] as "left" | "right" | null;
  const gap = (Number(player.state.timberProgress) || 0) - (Number(human?.state.timberProgress) || 0);
  // Adopt the player's cadence as soon as two accepted chops establish an interval.
  const humanProfile = bot.humanProfile.minigame;
  const observed = humanProfile.actions >= 2 ? humanProfile.intervalEwma : null;
  const base = observed ?? between(bot, 550, 800);
  const correction = gap > 0 ? 1 + Math.min(0.3, gap * 0.025) : 1 - Math.min(0.25, -gap * 0.025);
  const interval = humanizedInterval(
    bot,
    "timber",
    base * bot.traits.pace * correction,
    90,
    1_250,
    0.07 + (1 - bot.traits.consistency) * 0.12,
  );
  const learnedMistakeRate = humanProfile.accuracyEwma == null ? bot.traits.mistakeRate : 1 - humanProfile.accuracyEwma;
  const mistakeChance = clamp((bot.traits.mistakeRate * 0.35) + (learnedMistakeRate * 0.65) + humanProfile.recentMistakeBoost, 0.02, 0.42);
  const mistake = randomFor(bot) < mistakeChance;
  humanProfile.recentMistakeBoost *= 0.55;
  const safe: "left" | "right" = branch === "left" ? "right" : "left";
  return { at: Math.max(now + interval, Number(player.state.stunnedUntil || 0) + 30), side: mistake && branch ? branch : safe };
};
