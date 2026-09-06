import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import { appendChatMessage, type ChatMessage } from "../chat";
import type { GameContext, StoredGame } from "../games/contracts";
import { getGameMode } from "../games/registry";
import type { ConnectionState, PlayerIdentity } from "../types";
import { makeId, parseMessage, requestRoom, stateFromRequest } from "../utils";
import { decodeQuestionChunks, encodeQuestionChunks } from "../question-storage";
import { buildGameView, diffGameView, type GameView } from "./game-view";
import {
  beginBotChatGeneration,
  completeBotChatGeneration,
  dropNextBotGameAction,
  ensureBotActions,
  expireBotChatJobs,
  failBotChatGeneration,
  initializeBots,
  nextBotChatExpiry,
  nextBotDeadline,
  observeHumanAction,
  runNextBotAction,
  scheduleBotChatReply,
} from "../bots/controller";
import type { BotChatDispatch } from "../bots/chat";

const DISCONNECT_GRACE_MS = 30_000;
// v3: game.update carries a generic room/players diff (see servers/game-view.ts) instead of the
// old hand-rolled per-mode delta payloads, and broadcasts are coalesced (MIN_BROADCAST_INTERVAL_MS)
// rather than sent once per mutation. Older connections still get full game.snapshot messages.
const PROTOCOL_VERSION = 3;
const MAX_RECENT_SNAPSHOT_EVENTS = 200;
/** Coalescing window for game.update broadcasts - multiple mutations within this window collapse
 * into a single broadcast instead of one per bot action. */
const MIN_BROADCAST_INTERVAL_MS = 100;
/** How often the persisted "game" value is actually written while nothing structurally
 * significant has happened, as a time-based floor. Structural changes (phase/status/chat) always
 * checkpoint immediately regardless of this floor - see shouldCheckpoint. */
const CHECKPOINT_INTERVAL_ACTIVE_MS = 5_000;
const CHECKPOINT_INTERVAL_IDLE_MS = 30_000;
const MAX_RTT_MS = 400;
const MAX_COMPENSATION_MS = 150;
/** A bot action already this far past is discarded rather than executed - see runAlarm. */
const STALE_BOT_ACTION_MS = 250;
const MAX_BOT_ACTIONS_PER_TICK = 4;
const MAX_DEADLINES_PER_TICK = 4;
/** Fast-path in-memory tick, clamped to this range. Naturally lands near the lower bound during
 * active minigame phases (bot actions are >=90ms apart) and near the upper bound during the idle
 * 120s question phase. */
const MIN_TICK_MS = 50;
const MAX_TICK_MS = 1_000;
// A tick intentionally idling out to MAX_TICK_MS between actions is normal, not a stall - this
// must stay comfortably above MAX_TICK_MS or every idle tick logs a false-positive warning.
const STALL_WARN_MS = MAX_TICK_MS * 3;
/** Durable-alarm safety net. When someone is connected this is refreshed on every tick purely as
 * a backstop in case the in-memory timer fails to fire (Durable Object timer reliability isn't
 * documented, so this is what keeps the design correct even if that assumption is wrong - see
 * armTick/scheduleNextAlarm). When no one is connected, the alarm instead targets the next
 * genuinely meaningful deadline directly (see computeActiveDeadlines). */
const BACKSTOP_ALARM_MS = 5_000;
/** Log a breakdown well before ctx.storage's 128 KiB per-value ceiling, so growth is visible early. */
const STORAGE_VALUE_WARN_BYTES = 96 * 1024;
const SUMMARY_EVENT_TYPES = new Set([
  "GAME_STARTED", "GAME_ENDED", "QUESTION_RESOLVED", "ROUND_RESOLVED",
  "TIMBER_ROUND_RESOLVED", "PUNCTURE_ROUND_RESOLVED", "FLUTTER_ROUND_RESOLVED",
]);

export class GameServer extends Server<Env> {
  // Deliberately NOT hibernated, unlike UserServer/SocialPartyServer. Hibernation resets in-memory
  // state between events and adds cold-wake latency - fine for those two (idle-heavy, minutes
  // between messages), wrong for this one (a continuous sub-second simulation that needs
  // authoritative state resident in memory). An active game typically lasts a few minutes; that
  // in-memory time is cheap next to the alarm/storage-write volume the old per-action-alarm model
  // required (see servers/matchmaker.ts and this file's history for the idle-cost side of that
  // tradeoff, which is unaffected - UserServer/SocialPartyServer remain hibernated).
  static options = { hibernate: false };
  game: StoredGame | null = null;
  scheduledAlarmAt: number | null = null;
  questionsLoaded = false;
  /** Monotonic simulation clock. Never moves backwards, even if Date.now() does. */
  simNow = 0;
  tickTimer: ReturnType<typeof setTimeout> | null = null;
  timerTickCount = 0;
  alarmTickCount = 0;
  // Checkpoint throttling (A4): persistence decoupled from simulation.
  lastCheckpointAt = 0;
  lastCheckpointedPhase: string | null = null;
  lastCheckpointedStatus: string | null = null;
  lastCheckpointedChatLength = 0;
  // Broadcast coalescing + generic diffing (B1/B3).
  lastBroadcastView: GameView | null = null;
  lastBroadcastEventSequence = 0;
  lastBroadcastChatLength = 0;
  broadcastDirty = false;
  lastBroadcastAt = 0;
  broadcastTimer: ReturnType<typeof setTimeout> | null = null;

  async onStart() {
    this.game = (await this.ctx.storage.get<StoredGame>("game")) ?? null;
    this.scheduledAlarmAt = await this.ctx.storage.getAlarm();
    this.questionsLoaded = false;
    if (!this.game) return;

    const embeddedQuestions = this.embeddedQuestions();
    if (embeddedQuestions.length && !this.game.privateState.questionStorageKeys) {
      // Migrate games created before questions were split out of the main game value.
      await this.storeQuestions(embeddedQuestions);
      this.attachQuestions(embeddedQuestions);
      this.questionsLoaded = true;
      await this.save();
    }
    const botRuntimesBefore = JSON.stringify(this.game.privateState.botRuntimes ?? null);
    initializeBots(this.game);
    ensureBotActions(this.game, Date.now());
    if (JSON.stringify(this.game.privateState.botRuntimes ?? null) !== botRuntimesBefore) await this.save();
    await this.scheduleNextAlarm();
    // Always a no-op in practice (onStart only ever runs on a cold instance, which by definition
    // has no connections yet - see partyserver's #ensureInitialized), kept for defensiveness.
    this.armTick();
  }

  /**
   * Question payloads are decoded from chunked storage lazily, only when the current phase
   * actually needs them, so a trivial reconnect/ping doesn't pay for a full decode on every
   * hibernation wake. Deliberately swallows its own errors (logging instead) rather than
   * throwing: this runs inside GameServer.onAlarm's loop and inside afterMutation, and an
   * uncaught exception there propagates out of onAlarm uncaught (partyserver's alarm() wrapper
   * has no try/catch), which triggers Cloudflare's platform-level alarm retry with exponential
   * backoff (2s/4s/8s/16s/32s/64s, up to 6 attempts) - i.e. the whole game silently freezes for
   * up to ~30s and then fast-forwards through the backlog in one burst once a retry succeeds.
   */
  private async ensureQuestionsLoaded() {
    if (this.questionsLoaded || !this.game || (this.game.state.phase !== "question_active" && this.game.state.phase !== "finished")) return;
    const questionStorageKeys = this.game.privateState.questionStorageKeys as string[][] | undefined;
    if (!questionStorageKeys?.length) return;
    try {
      const questions = await Promise.all(questionStorageKeys.map(async (keys, index) => {
        const chunks = await Promise.all(keys.map((key) => this.ctx.storage.get<Uint8Array>(key)));
        const missingCount = chunks.filter((chunk) => !chunk).length;
        if (missingCount) throw new Error(`Question ${index} is missing ${missingCount}/${chunks.length} chunk(s) (keys: ${keys.join(", ")}).`);
        return decodeQuestionChunks(chunks as Uint8Array[]);
      }));
      this.attachQuestions(questions);
      this.questionsLoaded = true;
    } catch (error) {
      console.error(`[GameServer:${this.game.gameId}] ensureQuestionsLoaded failed (modeId=${this.game.modeId}, phase=${this.game.state.phase}):`, error);
    }
  }

  async onConnect(connection: Connection, context: ConnectionContext) {
    const state = stateFromRequest(context.request);
    connection.setState(state);
    const player = this.game?.players.find((entry) => entry.userId === state.userId);
    if (!player) return connection.close(1008, "Not a player in this game");
    if (player.disconnectedAt != null) {
      player.disconnectedAt = null;
      await this.checkpoint(true);
    }
    await this.ensureQuestionsLoaded();
    this.emit(connection);
    // A connection just appeared - shouldTick() may now be true. armTick() alone would leave the
    // durable alarm on its old (possibly much-later) precise-deadline target, so also refresh it.
    await this.scheduleNextAlarm();
    this.armTick();
  }

  async onMessage(connection: Connection, raw: WSMessage) {
    const message = parseMessage(raw);
    const identity = connection.state as PlayerIdentity;
    if (!message || !this.game || !identity?.userId) return;
    await this.ensureQuestionsLoaded();
    if (message.type === "game.subscribe" || message.type === "game.resync") return this.emit(connection, message.id);
    if (message.type === "system.clockPing") {
      const receivedAt = Date.now();
      return this.sendMessage(connection, "system.clockPong", {
        clientWallTime: Number((message.payload as any)?.clientWallTime) || 0,
        clientMonotonic: Number((message.payload as any)?.clientMonotonic) || 0,
        serverReceivedAt: receivedAt,
        serverSentAt: Date.now(),
      }, message.id);
    }
    if (message.type === "system.rttReport") {
      const rttMs = Math.max(0, Math.min(MAX_RTT_MS, Number((message.payload as any)?.rttMs) || 0));
      connection.setState({ ...(connection.state as ConnectionState), rttMs });
      return;
    }
    let chatDispatches: BotChatDispatch[] = [];
    let changed = false;
    if (message.type === "chat.send" || message.type === "game.chat") {
      const appended = this.addChat(identity, message.payload as any);
      if (!identity.isBot && appended) chatDispatches = scheduleBotChatReply(this.game, appended, Date.now());
      changed = Boolean(appended);
    }
    else if (message.type === "game.leave") {
      this.forfeit(identity.userId);
      await requestRoom(this.env.USER, identity.userId, { type: "game.finished", gameId: this.name });
      changed = true;
    }
    else {
      const engine = this.engine();
      const now = Date.now();
      const deadline = engine?.nextDeadline(this.game) ?? null;
      if (engine && deadline && now >= deadline) {
        engine.handleDeadline(this.game, this.context(now));
        changed = true;
      } else {
        const before = { ...(this.game.players.find((player) => player.userId === identity.userId)?.state ?? {}) };
        const rttMs = Number((connection.state as ConnectionState)?.rttMs) || 0;
        const nowCompensated = now - Math.min(MAX_COMPENSATION_MS, rttMs / 2);
        const result = engine?.handleAction(this.game, identity.userId, message, this.context(now, nowCompensated));
        if (result?.reply) this.sendMessage(connection, result.reply.type, result.reply.payload, message.id);
        changed = Boolean(result?.changed);
        if (changed) observeHumanAction(this.game, identity.userId, message, now, before);
      }
    }
    if (!changed) return;
    ensureBotActions(this.game, Date.now());
    await this.afterMutation();
    if (chatDispatches.length) await Promise.all(chatDispatches.map((dispatch) => this.dispatchBotChatJob(dispatch)));
  }

  async onClose(connection: Connection) {
    const identity = connection.state as PlayerIdentity;
    const player = this.game?.players.find((entry) => entry.userId === identity?.userId);
    const stillConnected = [...this.getConnections<PlayerIdentity>()].some((candidate) => candidate.state?.userId === identity?.userId);
    if (!stillConnected && player && this.game?.status === "active") {
      player.disconnectedAt = Date.now();
      // Forced: this must survive an eviction for the disconnect-grace timeout to fire correctly
      // even if the DO becomes evictable (last connection closing) before the throttled floor
      // would otherwise have saved it.
      await this.afterMutation(true); // re-arms the tick/alarm internally
    } else {
      // No game-state change, but the connection count just dropped - shouldTick() may now be
      // false (last connection overall just closed), so the fast timer must stop.
      await this.scheduleNextAlarm();
      this.armTick();
    }
  }

  async onRequest(request: Request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const body = await request.json<any>();
    if (body.type === "bot.chatContext") {
      if (!this.game) return new Response("Game not found", { status: 404 });
      const result = beginBotChatGeneration(this.game, String(body.botUserId ?? ""), String(body.jobId ?? ""), Number(body.revision), Date.now());
      await this.save();
      await this.scheduleNextAlarm();
      if (!result) return new Response("Chat job is stale", { status: 409 });
      if (result.retryAt) return Response.json({ retryAt: result.retryAt }, { status: 425 });
      return Response.json({ request: result.request });
    }
    if (body.type === "bot.chatResult") {
      if (!this.game) return new Response("Game not found", { status: 404 });
      const accepted = completeBotChatGeneration(
        this.game,
        String(body.botUserId ?? ""),
        String(body.jobId ?? ""),
        Number(body.revision),
        String(body.text ?? ""),
        Date.now(),
      );
      if (!accepted) return new Response("Chat job is stale", { status: 409 });
      await this.afterMutation();
      return Response.json({ ok: true });
    }
    if (body.type === "bot.chatFailed") {
      if (!this.game) return new Response("Game not found", { status: 404 });
      const accepted = failBotChatGeneration(this.game, String(body.botUserId ?? ""), String(body.jobId ?? ""), Number(body.revision));
      if (!accepted) return new Response("Chat job is stale", { status: 409 });
      await this.afterMutation();
      return Response.json({ ok: true });
    }
    if (body.type === "game.sessionStatus") {
      if (!this.game) return new Response("Game not found", { status: 404 });
      return Response.json({
        status: this.game.status,
        playerIds: this.game.players.map((player) => player.userId),
      });
    }
    if (body.type !== "game.initialize") return new Response("Unknown request", { status: 400 });
    if (this.game) return Response.json({ ok: true, gameId: this.name });
    const mode = getGameMode(body.modeId);
    if (!mode || body.players?.length !== mode.playerCount) return new Response("Invalid game configuration", { status: 400 });
    const now = Date.now();
    this.game = {
      gameId: this.name, modeId: mode.id, ranked: Boolean(body.ranked), status: "active",
      players: body.players.map((player: PlayerIdentity) => ({ ...player, state: {}, disconnectedAt: null })),
      state: {}, privateState: {}, events: [], chat: [], startedAt: now, updatedAt: now,
    };
    let questions: any[];
    try {
      questions = await this.fetchQuestions(mode.id, 10);
    } catch (error) {
      this.game = null;
      return new Response(error instanceof Error ? error.message : "Unable to load questions", { status: 502 });
    }
    if (questions.length < 10) {
      this.game = null;
      return new Response(`Question provider returned ${questions.length} questions; expected 10.`, { status: 502 });
    }
    await this.storeQuestions(questions);
    mode.createGame().initialize(this.game, questions, this.context());
    this.questionsLoaded = true;
    initializeBots(this.game);
    ensureBotActions(this.game, now);
    await this.afterMutation();
    return Response.json({ ok: true, gameId: this.name });
  }

  async onAlarm() {
    await this.guardedTick("alarm");
  }

  /**
   * Never rethrows. partyserver's alarm() wrapper has no try/catch (unlike its fetch/webSocket
   * handlers), so an escaping error would hit Cloudflare's *silent* alarm retry backoff
   * (2/4/8/16/32/64s, then abandoned entirely) - which is itself what makes ticks run late and
   * strands games with nothing in the logs. We own rescheduling instead, and always reschedule.
   * Shared by both tick sources (the durable alarm and the fast in-memory timer) so a caught
   * failure in either is handled identically.
   */
  private async guardedTick(source: "alarm" | "timer") {
    if (source === "timer") this.timerTickCount += 1; else this.alarmTickCount += 1;
    console.debug(`[GameServer:${this.name}] tick`, { source, timerTicks: this.timerTickCount, alarmTicks: this.alarmTickCount, phase: this.game?.state?.phase });
    try {
      await this.runAlarm();
    } catch (error) {
      console.error(`[GameServer:${this.name}] tick failed`, {
        source,
        phase: this.game?.state?.phase,
        status: this.game?.status,
        revision: this.game?.revision,
      }, error);
    }
    try {
      await this.scheduleNextAlarm();
    } catch (error) {
      console.error(`[GameServer:${this.name}] failed to reschedule alarm`, error);
    }
    this.armTick();
  }

  /** Deadlines that could plausibly need attention next - shared by the fast timer (clamped, see
   * armTick) and the backstop alarm (used verbatim when no one is connected to tick fast for). */
  private computeActiveDeadlines(): number[] {
    if (!this.game || this.game.status !== "active") return [];
    return [
      this.engine()?.nextDeadline(this.game) ?? null,
      nextBotDeadline(this.game),
      nextBotChatExpiry(this.game),
      ...this.game.players.filter((player) => !player.isBot).map((player) => (player.disconnectedAt ? player.disconnectedAt + DISCONNECT_GRACE_MS : null)),
    ].filter((value): value is number => value != null);
  }

  /** Only worth ticking fast while the game is active and at least one human is actually watching
   * (bots never hold a real Connection, so any open connection is a human). */
  private shouldTick(): boolean {
    return Boolean(this.game) && this.game!.status === "active" && [...this.getConnections()].length > 0;
  }

  private clearTickTimer() {
    if (this.tickTimer == null) return;
    clearTimeout(this.tickTimer);
    this.tickTimer = null;
  }

  /**
   * The fast path: a plain in-memory timer, not a Durable Object alarm. Cheap (no storage write)
   * and precise, but its reliability inside a DO isn't documented, so correctness never depends
   * on it firing - scheduleNextAlarm's backstop alarm (BACKSTOP_ALARM_MS) recovers within a few
   * seconds if it doesn't. If wrangler dev logging (see guardedTick) ever shows alarmTicks
   * dominating timerTicks during active play, that assumption has failed and this should become a
   * fixed ~200ms self-rescheduling alarm instead.
   */
  private armTick() {
    this.clearTickTimer();
    if (!this.shouldTick()) return;
    const deadlines = this.computeActiveDeadlines();
    if (!deadlines.length) return;
    const dueAt = Math.min(...deadlines);
    const delay = Math.max(MIN_TICK_MS, Math.min(MAX_TICK_MS, dueAt - Date.now()));
    this.tickTimer = setTimeout(() => {
      this.tickTimer = null;
      this.guardedTick("timer").catch((error) => console.error(`[GameServer:${this.name}] timer tick failed`, error));
    }, delay);
  }

  /**
   * A real-time server may catch up its *clock*. It may never catch up its *simulation* by
   * replaying player-visible actions faster than wall-clock. Lateness is paid for by DROPPING
   * actions, never by replaying them - replaying is what turned a late tick into "the bot went
   * from 0 to 49 chops and instantly won".
   */
  private async runAlarm() {
    if (!this.game) return;
    this.scheduledAlarmAt = null;
    if (this.game.status !== "active") {
      if (this.game.result && !this.game.privateState.resultCommitted) await this.commitResult();
      if (this.game.privateState.expiresAt && Date.now() >= this.game.privateState.expiresAt && (this.game.privateState.resultCommitted || !this.game.result)) {
        await this.ctx.storage.deleteAll();
        this.game = null;
        return;
      }
      return;
    }

    const wall = Date.now();
    const lateness = this.simNow ? wall - this.simNow : 0;
    this.simNow = Math.max(this.simNow, wall);
    if (lateness > STALL_WARN_MS) {
      console.warn(`[GameServer:${this.name}] tick stalled ${lateness}ms (phase=${this.game.state.phase})`);
    }

    expireBotChatJobs(this.game, this.simNow);
    const disconnected = this.game.players.find((player) => player.disconnectedAt && this.simNow - player.disconnectedAt >= DISCONNECT_GRACE_MS);
    if (disconnected) {
      this.forfeit(disconnected.userId);
      await this.afterMutation();
      return;
    }

    const engine = this.engine();
    if (engine) {
      await this.ensureQuestionsLoaded();

      // Engine deadlines. The first uses its genuine deadline so remainingMs and friends reflect
      // reality; any chained transition in the same tick uses simNow, otherwise a 3s result
      // overlay would be started in the past and flash by in zero visible time.
      for (let count = 0; count < MAX_DEADLINES_PER_TICK && this.game.status === "active"; count += 1) {
        const gameDeadline = engine.nextDeadline(this.game);
        if (gameDeadline == null || gameDeadline > this.simNow) break;
        engine.handleDeadline(this.game, this.context(count === 0 ? gameDeadline : this.simNow));
        ensureBotActions(this.game, this.simNow);
        await this.ensureQuestionsLoaded();
      }

      // Bot actions. Executed at their exact planned time (planners choose times whose world
      // state is favourable), but always re-planned from simNow so the next action lands in the
      // future and the loop cannot chain a backlog.
      let executed = 0;
      let dropped = 0;
      for (let guard = 0; guard < 32 && this.game.status === "active"; guard += 1) {
        const botDeadline = nextBotDeadline(this.game);
        if (botDeadline == null || botDeadline > this.simNow) break;
        if (botDeadline < this.simNow - STALE_BOT_ACTION_MS && dropNextBotGameAction(this.game, this.simNow)) {
          dropped += 1;
          continue;
        }
        if (executed >= MAX_BOT_ACTIONS_PER_TICK) break;
        if (!runNextBotAction(this.game, engine, this.context(botDeadline), this.simNow)) break;
        executed += 1;
      }
      if (dropped) {
        console.warn(`[GameServer:${this.name}] dropped ${dropped} stale bot action(s) after a ${lateness}ms stall`);
      }
    }

    await this.afterMutation();
  }

  private engine() { return this.game ? getGameMode(this.game.modeId)?.createGame() ?? null : null; }
  private context(now = Date.now(), nowCompensated = now): GameContext {
    return {
      now,
      nowCompensated,
      addEvent: (type, data = {}, actorUserId = null) => {
        if (!this.game) return;
        this.game.eventSequence = (Number(this.game.eventSequence) || this.game.events.at(-1)?.sequence || 0) + 1;
        this.game.events.push({ uid: makeId("event"), type, modeId: this.game.modeId, actorUserId, sequence: this.game.eventSequence, data, createdAt: now });
      },
    };
  }

  private snapshot() {
    if (!this.game) return null;
    const engine = this.engine();
    return {
      protocolVersion: PROTOCOL_VERSION,
      revision: Number(this.game.revision) || 0,
      serverNow: Date.now(),
      room: { uid: this.game.gameId, modeId: this.game.modeId, ranked: this.game.ranked, status: this.game.status === "active" ? "active" : "finished", state: engine?.publicState(this.game) ?? this.game.state },
      players: this.game.players.map(({ disconnectedAt, isBot: _isBot, ...player }) => player),
      events: this.snapshotEvents(),
      chat: this.game.chat,
    };
  }

  private snapshotEvents() {
    if (!this.game) return [];
    const recent = this.game.events.slice(-MAX_RECENT_SNAPSHOT_EVENTS);
    const recentIds = new Set(recent.map((event) => event.uid));
    return [
      ...this.game.events.filter((event) => SUMMARY_EVENT_TYPES.has(String(event.type)) && !recentIds.has(event.uid)),
      ...recent,
    ];
  }

  private sendMessage(connection: Connection, type: string, payload: unknown, id = makeId()) {
    connection.send(JSON.stringify({ id, type, payload, protocolVersion: PROTOCOL_VERSION, revision: Number(this.game?.revision) || 0, serverNow: Date.now() }));
  }
  private emit(connection: Connection, id = makeId()) { this.sendMessage(connection, "game.snapshot", this.snapshot(), id); }
  private async save() {
    if (!this.game) return;
    const privateState = { ...this.game.privateState };
    delete privateState.questions;
    delete privateState.questionsById;
    // Persist only the bounded (summary + recent-200) event view, never the full in-memory log -
    // ctx.storage caps a single value at 128 KiB, and events is otherwise unbounded for the life
    // of the match. The full in-memory this.game.events is untouched, so nothing observed
    // in-session (bot learning, the live event feed) is affected - only what a cold restart
    // recovers is bounded, and everything needed to reconstruct the match end screen
    // (SUMMARY_EVENT_TYPES) is exempt from the recency trim, so that screen is unaffected too.
    const value = { ...this.game, privateState, events: this.snapshotEvents() };
    const serializedLength = JSON.stringify(value).length;
    if (serializedLength > STORAGE_VALUE_WARN_BYTES) {
      console.error(`[GameServer:${this.name}] stored game is ${serializedLength}B, approaching the 131072B limit`, {
        events: value.events.length,
        chat: this.game.chat.length,
        eventsBytes: JSON.stringify(value.events).length,
        privateStateBytes: JSON.stringify(privateState).length,
      });
    }
    await this.ctx.storage.put("game", value);
  }

  private embeddedQuestions(): any[] {
    if (!this.game) return [];
    if (Array.isArray(this.game.privateState.questions)) return this.game.privateState.questions;
    return Object.values(this.game.privateState.questionsById ?? {});
  }

  private attachQuestions(questions: any[]) {
    if (!this.game) return;
    if (this.game.modeId === "blitz") this.game.privateState.questions = questions;
    else this.game.privateState.questionsById = Object.fromEntries(questions.map((question) => [question.id, question]));
  }

  private async storeQuestions(questions: any[]) {
    if (!this.game) return;
    const questionStorageKeys: string[][] = [];
    for (const [questionIndex, question] of questions.entries()) {
      const chunks = encodeQuestionChunks(question);
      const keys = chunks.map((_, chunkIndex) => `question:${questionIndex}:${chunkIndex}`);
      await Promise.all(chunks.map((chunk, chunkIndex) => this.ctx.storage.put(keys[chunkIndex], chunk)));
      questionStorageKeys.push(keys);
    }
    this.game.privateState.questionStorageKeys = questionStorageKeys;
  }

  /**
   * Called after every mutation (a human message, a tick's engine deadline or bot action). Does
   * NOT write to storage or broadcast synchronously - persistence is throttled (checkpoint, A4)
   * and broadcasts are coalesced to MIN_BROADCAST_INTERVAL_MS (scheduleBroadcast, B1), so this
   * returning does not mean clients have been notified yet. Pass forceCheckpoint for state that
   * must survive an eviction immediately (see onClose's disconnect branch).
   */
  private async afterMutation(forceCheckpoint = false) {
    if (!this.game) return;
    this.game.updatedAt = Date.now();
    if (this.game.status !== "active" && !this.game.privateState.expiresAt) this.game.privateState.expiresAt = Date.now() + 15 * 60_000;
    // Outbound fetches are best-effort: a slow or failing backend must never abort the state
    // write, the broadcast, or the alarm reschedule that follow.
    try {
      await this.releasePlayerSessions();
    } catch (error) {
      console.error(`[GameServer:${this.name}] releasePlayerSessions failed`, error);
    }
    await this.ensureQuestionsLoaded();
    await this.checkpoint(forceCheckpoint);
    this.scheduleBroadcast();
    if (this.game.result) {
      try {
        await this.commitResult();
      } catch (error) {
        console.error(`[GameServer:${this.name}] commitResult failed`, error);
      }
    }
    await this.scheduleNextAlarm();
    this.armTick();
  }

  /** Phase/status/chat changes always checkpoint immediately (they're rare and must not be lost);
   * everything else (mid-round position/score churn) is covered by the time floor. */
  private shouldCheckpoint(now: number): boolean {
    if (!this.game) return false;
    if ((this.game.state.phase ?? null) !== this.lastCheckpointedPhase) return true;
    if (this.game.status !== this.lastCheckpointedStatus) return true;
    if (this.game.chat.length !== this.lastCheckpointedChatLength) return true;
    const floor = String(this.game.state.phase ?? "").endsWith("_active") ? CHECKPOINT_INTERVAL_ACTIVE_MS : CHECKPOINT_INTERVAL_IDLE_MS;
    return now - this.lastCheckpointAt >= floor;
  }

  private async checkpoint(force = false) {
    if (!this.game) return;
    const now = Date.now();
    if (!force && !this.shouldCheckpoint(now)) return;
    await this.save();
    this.lastCheckpointAt = now;
    this.lastCheckpointedPhase = this.game.state.phase ?? null;
    this.lastCheckpointedStatus = this.game.status;
    this.lastCheckpointedChatLength = this.game.chat.length;
  }

  private clearBroadcastTimer() {
    if (this.broadcastTimer == null) return;
    clearTimeout(this.broadcastTimer);
    this.broadcastTimer = null;
  }

  private scheduleBroadcast() {
    if (!this.game) return;
    this.broadcastDirty = true;
    if (this.broadcastTimer != null) return;
    const delay = Math.max(0, MIN_BROADCAST_INTERVAL_MS - (Date.now() - this.lastBroadcastAt));
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      this.flushBroadcast();
    }, delay);
  }

  /** Increments revision and sends exactly once per published update (B2): every eligible
   * connection gets this same revision, either as a diff (v3+) or a full snapshot (older, or a
   * connection with no prior baseline). A no-op mutation (nothing visible actually changed) does
   * not bump revision or send anything. */
  private flushBroadcast() {
    if (!this.game || !this.broadcastDirty) return;
    this.broadcastDirty = false;
    this.lastBroadcastAt = Date.now();
    const view = buildGameView(this.game, this.engine());
    const patch = diffGameView(this.lastBroadcastView, view);
    const newEvents = this.game.events.filter((event) => Number(event.sequence) > this.lastBroadcastEventSequence);
    const newChat = this.game.chat.slice(this.lastBroadcastChatLength);
    if (!patch && !newEvents.length && !newChat.length) return;
    this.lastBroadcastView = view;
    if (this.game.events.length) this.lastBroadcastEventSequence = Math.max(this.lastBroadcastEventSequence, ...this.game.events.map((event) => Number(event.sequence) || 0));
    this.lastBroadcastChatLength = this.game.chat.length;
    this.game.revision = (Number(this.game.revision) || 0) + 1;
    let cachedSnapshot: unknown;
    for (const connection of this.getConnections<PlayerIdentity & { protocolVersion?: number }>()) {
      if (Number(connection.state?.protocolVersion) >= PROTOCOL_VERSION) {
        this.sendMessage(connection, "game.update", { room: patch?.room, players: patch?.players, events: newEvents, chat: newChat });
      } else {
        cachedSnapshot ??= this.snapshot();
        this.sendMessage(connection, "game.snapshot", cachedSnapshot);
      }
    }
  }

  private async releasePlayerSessions() {
    if (!this.game || this.game.status === "active" || this.game.privateState.playerSessionsReleased) return;
    const results = await Promise.allSettled(this.game.players.filter((player) => !player.isBot).map(async (player) => {
      const response = await requestRoom(this.env.USER, player.userId, { type: "game.finished", gameId: this.game!.gameId });
      if (!response.ok) throw new Error(`Unable to release ${player.userId}: ${response.status}`);
    }));
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      console.warn("Unable to release one or more finished game sessions.", { gameId: this.game.gameId, failed: failed.length });
      return;
    }
    this.game.privateState.playerSessionsReleased = true;
  }

  private async scheduleNextAlarm() {
    if (!this.game) return;
    let next: number | null;
    if (this.game.status === "active" && this.shouldTick()) {
      // The fast timer (armTick) is doing the real scheduling; this alarm is purely a backstop.
      next = Date.now() + BACKSTOP_ALARM_MS;
    } else if (this.game.status === "active") {
      // No one connected to tick fast for - wake exactly when something could matter instead
      // (typically a disconnect-grace timeout).
      const deadlines = this.computeActiveDeadlines();
      next = deadlines.length ? Math.min(...deadlines) : null;
    } else {
      const deadlines = [this.game.result && !this.game.privateState.resultCommitted ? Date.now() + 10_000 : null, this.game.privateState.expiresAt ?? null]
        .filter((value): value is number => Boolean(value));
      next = deadlines.length ? Math.min(...deadlines) : null;
    }
    if (next === this.scheduledAlarmAt) return;
    if (next == null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(next);
    this.scheduledAlarmAt = next;
  }

  private addChat(identity: PlayerIdentity, payload: { text?: string; clientMessageId?: string }): ChatMessage | null {
    if (!this.game) return null;
    const beforeUid = (this.game.chat.at(-1) as ChatMessage | undefined)?.uid;
    this.game.chat = appendChatMessage(this.game.chat as ChatMessage[], identity, payload);
    const appended = this.game.chat.at(-1) as ChatMessage | undefined;
    return appended?.uid && appended.uid !== beforeUid ? appended : null;
  }

  private async dispatchBotChatJob(dispatch: BotChatDispatch) {
    let response: Response | null = null;
    try {
      response = await requestRoom(this.env.BOTCHAT, dispatch.gameId, { type: "bot.chatSchedule", ...dispatch });
    } catch {
      response = null;
    }
    if (response?.ok || !this.game) return;
    if (failBotChatGeneration(this.game, dispatch.botUserId, dispatch.jobId, dispatch.revision)) await this.afterMutation();
  }

  private forfeit(userId: string) {
    if (!this.game || this.game.status !== "active") return;
    const engine = this.engine();
    const eventCountBefore = this.game.events.length;
    if (engine?.handleForfeit) engine.handleForfeit(this.game, userId, this.context());
    else {
      this.game.status = "abandoned";
      this.game.state.phase = "abandoned";
    }
    const engineEmittedGameEnd = this.game.events.slice(eventCountBefore).some((event) => event.type === "GAME_ENDED");
    if (!engineEmittedGameEnd) {
      this.context().addEvent("GAME_ENDED", { winnerUserId: this.game.result?.winnerUserId ?? null, endReason: this.game.result?.endReason ?? "abandoned", eloDeltaByUserId: {} });
    }
  }

  private async fetchQuestions(modeId: string, count: number): Promise<any[]> {
    if (!this.env.BACKEND_API_BASE_URL) return [];
    const response = await fetch(`${this.env.BACKEND_API_BASE_URL}/realtime/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modeId, count }),
    });
    if (!response.ok) throw new Error(`Question provider failed (${response.status}): ${await response.text()}`);
    return (await response.json() as { questions?: any[] }).questions ?? [];
  }

  private async commitResult() {
    if (!this.game?.result || this.game.privateState.resultCommitted) return;
    if (!this.env.BACKEND_API_BASE_URL) return;
    const response = await fetch(`${this.env.BACKEND_API_BASE_URL}/realtime/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...this.game.result, botPlayerIds: this.game.players.filter((player) => player.isBot).map((player) => player.userId) }),
    });
    if (!response.ok) return;
    const saved = await response.json() as { eloDeltaByUserId?: Record<string, number> };
    const endedEvent = [...this.game.events].reverse().find((event) => event.type === "GAME_ENDED");
    if (endedEvent && saved.eloDeltaByUserId) {
      endedEvent.data = { ...endedEvent.data, eloDeltaByUserId: saved.eloDeltaByUserId };
    }
    this.game.privateState.resultCommitted = true;
    await this.save();
    const snapshot = this.snapshot();
    for (const connection of this.getConnections()) this.sendMessage(connection, "game.snapshot", snapshot);
  }
}

export default GameServer;
