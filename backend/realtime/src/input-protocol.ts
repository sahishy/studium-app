import type { StoredGame } from "./games/contracts";
import type { RealtimeMessage } from "./types";

export const ARCADE_ACTIONS = new Set(["game.chop", "game.shoot", "game.flutterInput"]);
export const upgradedRoom = (gameId: string, percent: string | undefined) => {
  let hash = 2166136261;
  for (const c of gameId) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0) % 100 < Math.max(0, Math.min(100, Number(percent) || 0));
};
export const syncInputState = (game: StoredGame) => {
  game.state.netcodeVersion = game.privateState.netcodeVersion ?? 3;
  if (game.state.netcodeVersion < 4) return;
  game.state.inputEpoch = game.privateState.inputEpoch ??= 1;
  const phase = String(game.state.phase);
  const scope = phase === "question_active" ? "question" : /_(active|countdown)$/.test(phase) ? "arcade" : phase;
  const roundKey = JSON.stringify([scope, game.state.currentQuestionId, game.state.questionIndex,
    game.state.timberRoundIndex, game.state.punctureRoundIndex, game.state.flutterRoundIndex, game.state.flutterAttempt]);
  if (roundKey !== game.privateState.inputRoundKey) {
    game.privateState.inputRoundKey = roundKey;
    game.state.roundToken = crypto.randomUUID();
  }
};

type InputReply = Record<string, any>;
type Stream = { sequence: number; at: number; tokens: number; refillAt: number; replies: Map<string, InputReply> };
export class InputValidator {
  streams = new Map<string, Stream>();
  validate(game: StoredGame, userId: string, message: RealtimeMessage, now: number) {
    const p = (message.payload ?? {}) as Record<string, any>;
    const stream = this.streams.get(userId) ?? { sequence: -1, at: 0, tokens: message.type === "game.flutterInput" ? 16 : 5, refillAt: now, replies: new Map() };
    this.streams.set(userId, stream);
    const id = String(p.clientActionId || message.id);
    if (p.inputEpoch !== game.state.inputEpoch) return { reason: "stale_epoch" };
    if (p.roundToken !== game.state.roundToken) return { reason: "stale_round" };
    const duplicate = stream.replies.get(id);
    if (duplicate) return { duplicate };
    if (!Number.isSafeInteger(p.sequence) || p.sequence <= Math.max(stream.sequence, Number(game.players.find((p) => p.userId === userId)?.state.inputSequence ?? -1))) return { reason: "stale_sequence" };
    if (message.type === "game.answer") {
      if (p.questionId !== game.state.currentQuestionId) return { reason: "stale_question" };
      return { at: now, stream, id };
    }
    if (!Number.isFinite(p.occurredAt) || p.occurredAt < now - 250 || p.occurredAt > now + 25) return { reason: "invalid_time", timeErrorMs: Number.isFinite(p.occurredAt) ? now - p.occurredAt : undefined };
    const at = Math.min(now, p.occurredAt);
    if (at < stream.at) return { reason: "decreasing_time" };
    const flutter = message.type === "game.flutterInput";
    const capacity = flutter ? 16 : 5, rate = flutter ? 60 : 20;
    stream.tokens = Math.min(capacity, stream.tokens + Math.max(0, now - stream.refillAt) * rate / 1000);
    stream.refillAt = now;
    if (stream.tokens < 1) return { reason: "message_budget" };
    stream.tokens -= 1;
    return { at, stream, id };
  }
  record(userId: string, message: RealtimeMessage, reply: InputReply, at: number) {
    const stream = this.streams.get(userId);
    if (!stream) return;
    const p = message.payload as Record<string, any>;
    stream.sequence = p.sequence;
    if (reply.accepted && ARCADE_ACTIONS.has(message.type)) stream.at = at;
    this.remember(userId, message, reply);
  }
  remember(userId: string, message: RealtimeMessage, reply: InputReply) {
    const stream = this.streams.get(userId);
    if (!stream) return;
    const p = message.payload as Record<string, any>;
    stream.replies.set(String(p.clientActionId || message.id), reply);
    if (stream.replies.size > 128) stream.replies.delete(stream.replies.keys().next().value!);
  }
}
