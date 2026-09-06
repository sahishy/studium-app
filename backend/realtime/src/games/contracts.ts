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
  /** Monotonic source for event.sequence - independent of events.length, which changes when the
   * persisted event log is trimmed (see GameServer.save/snapshotEvents). */
  eventSequence?: number;
  chat: Array<Record<string, any>>;
  startedAt: number;
  updatedAt: number;
  revision?: number;
  result?: GameResult;
};

export type GameContext = {
  now: number;
  /** Latency-compensated estimate of when the acting player's input actually occurred. Equals `now` when there is no single acting player (e.g. handleDeadline) or no RTT sample yet. */
  nowCompensated: number;
  addEvent: (type: string, data?: Record<string, unknown>, actorUserId?: string | null) => void;
};

// Engines used to hand-roll a per-mode delta payload here so at least some updates could skip a
// full snapshot. GameServer now computes a generic diff for every mode automatically (see
// servers/game-view.ts, derived from the same publicState()/player.state this result's `changed`
// flag already gates), so engines only need to report whether anything changed.
export type GameActionReply = { type: string; payload: Record<string, unknown> };

export type GameActionResult = { changed: boolean; reply?: GameActionReply };

export const unchangedAction = (reply?: GameActionReply): GameActionResult => ({ changed: false, ...(reply ? { reply } : {}) });
export const changedAction = (reply?: GameActionReply): GameActionResult => ({ changed: true, ...(reply ? { reply } : {}) });

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
