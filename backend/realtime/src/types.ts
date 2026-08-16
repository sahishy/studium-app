export type RealtimeMessage<T = unknown> = { id: string; type: string; payload?: T };

export type PlayerIdentity = {
  userId: string;
  displayName: string;
  profilePicture: unknown;
  avatar?: Record<string, unknown> | null;
  eloByMode?: Record<string, number>;
  elo?: number;
  /** Server-only. Game snapshots deliberately remove this field. */
  isBot?: boolean;
};

export type QueueEntry = {
  id: string;
  userIds: string[];
  players: PlayerIdentity[];
  averageElo: number;
  joinedAt: number;
};

export type GameResult = {
  gameId: string;
  modeId: string;
  ranked: boolean;
  playerIds: string[];
  winnerUserId: string | null;
  scoreByUserId?: Record<string, number>;
  roundsPlayed?: number;
  endReason: string;
  startedAt: number;
  endedAt: number;
  /** Used only while committing the result; never persisted by the backend. */
  botPlayerIds?: string[];
};

export type ConnectionState = PlayerIdentity & { connectedAt: number; protocolVersion: number };

declare global {
  interface Env {
    BACKEND_API_BASE_URL: string;
    OPENAI_API_KEY?: string;
  }
}
