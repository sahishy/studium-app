import type { NetworkRegion } from "./network";

export type RealtimeMessage<T = unknown> = { id: string; type: string; payload?: T };

export type PlayerIdentity = {
  userId: string;
  networkRegion?: NetworkRegion;
  displayName: string;
  profilePicture: unknown;
  avatar?: Record<string, unknown> | null;
  eloByMode?: Record<string, number>;
  elo?: number;
  /** Cosmetic title, shown under the display name. */
  title?: string | null;
  level?: number;
  /** Per-mode placement state. For a mode the player has not placed in, `nextOpponentElo` is the
   * rating their next placement opponent should be pitched at - a new account is rated 0, so a bot
   * built from that rating alone would be far too weak to place anyone. */
  placementByMode?: Record<string, PlacementState>;
  /** Server-only. Game snapshots deliberately remove this field. */
  isBot?: boolean;
};

export type PlacementState = {
  placed: boolean;
  gamesPlayed: number;
  nextOpponentElo?: number;
};

export type QueueEntry = {
  id: string;
  userIds: string[];
  players: PlayerIdentity[];
  averageElo: number;
  joinedAt: number;
  /** Server-assigned deadline for falling back to a bot opponent. */
  botFillAt?: number;
  networkRegion?: NetworkRegion;
};

export type GameResult = {
  gameId: string;
  modeId: string;
  ranked: boolean;
  playerIds: string[];
  winnerUserId: string | null;
  scoreByUserId?: Record<string, number>;
  roundsPlayed?: number;
  participationByUserId?: Record<string, number>;
  endReason: string;
  startedAt: number;
  endedAt: number;
  /** Per-player question telemetry, used to scale match rewards and to accumulate SAT skill
   * mastery. Absent for modes that ask no questions, and for matches that started before the
   * telemetry shipped. */
  performanceByUserId?: Record<string, SatMatchPerformance>;
  gameplayByUserId?: Record<string, GameplayPerformance>;
  /** Used only while committing the result; never persisted by the backend. */
  botPlayerIds?: string[];
  /** Opponent ratings at the moment the match ended, bots included, so the backend can price a
   * win against a stronger player without a second lookup. */
  eloByUserId?: Record<string, number>;
};

export type GameplayPerformance = {
  trackedFromStart: boolean;
  timberLogsChopped: number;
  puncturePinsPlaced: number;
  flutterRingsCleared: number;
  stuns: number;
};

export type SatMatchPerformance = {
  faced: number;
  answered: number;
  correct: number;
  roundsWon: number;
  avgAnswerMs: number | null;
  byDomain: Record<string, { answered: number; correct: number }>;
  byDifficulty: Record<string, { answered: number; correct: number }>;
};

export type ConnectionRole = "player" | "spectator";

export type ConnectionState = PlayerIdentity & {
  connectedAt: number;
  protocolVersion: number;
  rttMs?: number;
  jitterMs?: number;
  admissionOnly?: boolean;
  /** Assigned by the room server after it checks whether this user is a participant. */
  connectionRole?: ConnectionRole;
};

declare global {
  interface Env {
    BACKEND_API_BASE_URL: string;
    REALTIME_ACTIVITY_SECRET?: string;
    OPENAI_API_KEY?: string;
    GAME_ADMISSION_SECRET?: string;
    STAGING_TEST_ENABLED?: string;
    STAGING_TEST_SECRET?: string;
  }
}
