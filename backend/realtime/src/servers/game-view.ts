import type { GameEngine, StoredGame } from "../games/contracts";

/**
 * The client-visible slice of a game: the public room state each engine already computes via
 * publicState(), plus every player's own state. Diffing this (rather than hand-rolling a delta
 * per mode, the old approach) gives every mode - including Timber, which previously had no delta
 * path at all and always broadcast a full snapshot - a compact update for free, and the diff
 * cannot drift from the snapshot because both are derived from the exact same publicState() call.
 */
export type GameView = {
  room: Record<string, unknown>;
  players: Record<string, Record<string, unknown>>;
};

export const buildGameView = (game: StoredGame, engine: GameEngine | null): GameView => ({
  // `status` rides alongside publicState()'s fields (rather than living only in the outer
  // snapshot wrapper) specifically so it participates in the same diff as everything else - most
  // engines already flip game.state.phase to "finished" too, but status is the field the client
  // actually branches on for match-end, and it must never go stale under diff-only updates.
  room: { ...(engine?.publicState(game) ?? game.state), status: game.status } as Record<string, unknown>,
  // Shallow-cloned, NOT a live reference. Engines mutate player.state's fields in place
  // (player.state.pinsRemaining = ...) rather than reassigning the object, so without this clone
  // a stored view and every later view are the literal same object - diffing it against itself
  // always finds nothing changed, silently dropping every player-state update forever after the
  // first broadcast (pins, answered questions, shot confirmations, all of it).
  players: Object.fromEntries(game.players.map((player) => [player.userId, { ...player.state } as Record<string, unknown>])),
});

export type GameUpdatePayload = {
  room?: Record<string, unknown>;
  players?: Record<string, Record<string, unknown>>;
};

/** Shallow, per-top-level-key equality diff. A changed key is resent in full (never deep-diffed
 * further) - simple, and every field involved here is small enough that this is cheap. A removed
 * key is emitted as `null` so the client can delete it. */
const diffRecord = (previous: Record<string, unknown> | undefined, next: Record<string, unknown>): Record<string, unknown> | null => {
  let patch: Record<string, unknown> | null = null;
  const keys = new Set([...Object.keys(previous ?? {}), ...Object.keys(next)]);
  for (const key of keys) {
    const nextValue = next[key];
    if (JSON.stringify(previous?.[key]) === JSON.stringify(nextValue)) continue;
    patch ??= {};
    patch[key] = nextValue === undefined ? null : nextValue;
  }
  return patch;
};

/** Null `previous` means "no baseline" (a fresh connection) - callers must send a full
 * game.snapshot in that case instead of calling this; a diff against nothing isn't meaningful. */
export const diffGameView = (previous: GameView | null, next: GameView): GameUpdatePayload | null => {
  const roomPatch = diffRecord(previous?.room, next.room);
  let playersPatch: Record<string, Record<string, unknown>> | null = null;
  for (const [userId, state] of Object.entries(next.players)) {
    const patch = diffRecord(previous?.players?.[userId], state);
    if (patch) (playersPatch ??= {})[userId] = patch;
  }
  if (!roomPatch && !playersPatch) return null;
  const result: GameUpdatePayload = {};
  if (roomPatch) result.room = roomPatch;
  if (playersPatch) result.players = playersPatch;
  return result;
};
