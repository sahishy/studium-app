import type { StoredGame } from "../games/contracts";
import { generateFlutterRingCenters } from "../games/flutter";
import { between, clamp, randomFor } from "./random";
import type { BotRuntime } from "./types";

export const flutterMissProbability = (elo: number, ringIndex: number, baseMistake: number) => (
  ringIndex < 2 ? 0 : clamp(baseMistake + (1 - clamp(elo / 1600, 0, 1)) * 0.08 + (ringIndex - 1) * 0.012, 0.025, 0.35)
);

export const planFlutterAction = (game: StoredGame, bot: BotRuntime, now: number) => {
  const player = game.players.find((p) => p.userId === bot.userId)!;
  const ring = Number(game.state.flutterRingIndex) || 0;
  if (bot.lastFlutterPlannedRing !== ring) {
    const elo = Number(player.elo ?? player.eloByMode?.[game.modeId]) || 0;
    const learnedMistakeRate = bot.humanProfile.minigame.accuracyEwma == null
      ? bot.traits.mistakeRate
      : 1 - bot.humanProfile.minigame.accuracyEwma;
    const competitiveMistakeRate = bot.humanProfile.minigame.roundsCompleted > 0
      ? bot.traits.mistakeRate * 0.4 + learnedMistakeRate * 0.6
      : bot.traits.mistakeRate;
    bot.lastFlutterPlannedRing = ring;
    bot.flutterMissRing = randomFor(bot) < flutterMissProbability(elo, ring, competitiveMistakeRate) ? ring : null;
    const missRadius = bot.flutterMissRing === ring ? between(bot, 1.7, 2.15) : between(bot, 0.02, 0.14);
    const aimAngle = between(bot, 0, Math.PI * 2);
    bot.flutterAimX = Math.cos(aimAngle) * missRadius;
    bot.flutterAimY = Math.sin(aimAngle) * missRadius;
  }
  const center = generateFlutterRingCenters(Number(game.state.flutterSeed), ring + 1)[ring] ?? { x: 0, y: 0 };
  const target = {
    x: clamp(center.x + Number(bot.flutterAimX || 0), -5.05, 5.05),
    y: clamp(center.y + Number(bot.flutterAimY || 0), -3, 3),
  };
  const input = (player.state.flutterInput ?? {}) as Record<string, boolean>;
  const isMoving = Boolean(input.up || input.down || input.left || input.right);
  bot.sequence += 1;
  if (isMoving) {
    // Release quickly after a short pulse instead of holding full-speed movement.
    return {
      at: now + between(bot, 110, 260),
      payload: { sequence: bot.sequence, left: false, right: false, down: false, up: false },
    };
  }

  const predictedX = Number(player.state.flutterX || 0) + Number(player.state.flutterVelocityX || 0) * 0.18;
  const predictedY = Number(player.state.flutterY || 0) + Number(player.state.flutterVelocityY || 0) * 0.18;
  const dx = target.x - predictedX;
  const dy = target.y - predictedY;
  const distance = Math.hypot(dx, dy);
  const passAt = Number(game.state.flutterCurrentRingPassAt) || now + 1_000;
  const timeToRing = passAt - now;
  const deadZone = bot.flutterMissRing === ring ? 0.28 : 0.18;
  if (distance <= deadZone) {
    return {
      at: now + between(bot, 380, 720),
      payload: { sequence: bot.sequence, left: false, right: false, down: false, up: false },
    };
  }

  const reaction = timeToRing < 500 ? between(bot, 70, 150) : clamp(bot.traits.reactionMs + between(bot, -80, 140), 190, 520);
  const horizontalDeadZone = Math.max(0.16, Math.abs(dy) * 0.18);
  const verticalDeadZone = Math.max(0.16, Math.abs(dx) * 0.18);
  return {
    at: now + reaction,
    payload: {
      sequence: bot.sequence,
      left: dx < -horizontalDeadZone,
      right: dx > horizontalDeadZone,
      down: dy < -verticalDeadZone,
      up: dy > verticalDeadZone,
    },
  };
};
