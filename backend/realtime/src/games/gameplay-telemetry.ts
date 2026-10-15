import type { GameplayPerformance } from "../types";
import type { StoredGame } from "./contracts";

const emptyPerformance = (trackedFromStart: boolean): GameplayPerformance => ({
  trackedFromStart,
  timberLogsChopped: 0,
  puncturePinsPlaced: 0,
  flutterRingsCleared: 0,
  stuns: 0,
});

// Match totals stay private and survive round resets and room hibernation.
export const initializeGameplayTelemetry = (game: StoredGame) => {
  game.privateState.gameplayByUserId = Object.fromEntries(
    game.players.map((player) => [player.userId, emptyPerformance(true)]),
  );
};

export const recordGameplayAction = (
  game: StoredGame,
  userId: string,
  metric: "timberLogsChopped" | "puncturePinsPlaced" | "flutterRingsCleared" | "stuns",
) => {
  const store = (game.privateState.gameplayByUserId ??= {}) as Record<string, GameplayPerformance>;
  // Already-running matches can contribute actions, but cannot prove a stun-free match.
  const performance = (store[userId] ??= emptyPerformance(false));
  performance[metric] += 1;
};

export const buildGameplayTelemetry = (game: StoredGame) => game.privateState.gameplayByUserId
  ? { gameplayByUserId: structuredClone(game.privateState.gameplayByUserId) as Record<string, GameplayPerformance> }
  : {};
