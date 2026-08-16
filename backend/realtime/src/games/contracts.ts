import type { GameResult, PlayerIdentity, RealtimeMessage } from "../types";

export type StoredGame = {
  gameId: string;
  modeId: string;
  ranked: boolean;
  status: "active" | "finished" | "abandoned";
  players: Array<PlayerIdentity & { state: Record<string, unknown>; disconnectedAt?: number | null }>;
  state: Record<string, any>;
  privateState: Record<string, any>;
  events: Array<Record<string, any>>;
  chat: Array<Record<string, any>>;
  startedAt: number;
  updatedAt: number;
  revision?: number;
  result?: GameResult;
};

export type GameContext = {
  now: number;
  addEvent: (type: string, data?: Record<string, unknown>, actorUserId?: string | null) => void;
};

export type GameActionResult = {
  changed: boolean;
  delivery?: "snapshot" | "delta";
  delta?: { type: string; payload: Record<string, unknown> };
};

export const unchangedAction = (): GameActionResult => ({ changed: false });
export const changedAction = (delta?: GameActionResult["delta"]): GameActionResult => ({
  changed: true,
  delivery: delta ? "delta" : "snapshot",
  delta,
});

export type GameEngine = {
  initialize: (game: StoredGame, questions: any[], context: GameContext) => void;
  handleAction: (game: StoredGame, userId: string, message: RealtimeMessage, context: GameContext) => GameActionResult;
  handleDeadline: (game: StoredGame, context: GameContext) => void;
  publicState: (game: StoredGame) => Record<string, unknown>;
  nextDeadline: (game: StoredGame) => number | null;
  handleForfeit?: (game: StoredGame, leaverUserId: string, context: GameContext) => void;
};

export type GameModeDefinition = {
  id: string;
  name: string;
  playerCount: number;
  ranked: boolean;
  supportsPublicMatchmaking: boolean;
  supportsPartyGames: boolean;
  createGame: () => GameEngine;
};
