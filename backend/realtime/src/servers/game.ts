import { ARCADE_ACTIONS, InputValidator, syncInputState, upgradedRoom } from "../input-protocol";
import { RoomLatency } from "../latency";
import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import { appendChatMessage, appendSystemChatMessage, type ChatMessage } from "../chat";
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
import { canSpectatorSendMessage, getGameConnectionRole } from "../connection-role";

const DISCONNECT_GRACE_MS = 30_000;
// v3: game.update carries a generic room/players diff (see servers/game-view.ts) instead of the
// old hand-rolled per-mode delta payloads, and broadcasts are coalesced (MIN_BROADCAST_INTERVAL_MS)
// rather than sent once per mutation. Older connections still get full game.snapshot messages.
const PROTOCOL_VERSION = 4;
const PATCH_PROTOCOL_VERSION = 3;
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
// A short pre-roll before the first question, so the match intro animation has somewhere to play
// that is not on top of live gameplay. Classic otherwise opens straight into question_active, and
// an overlay there would eat answering time. Every engine is initialized as though the match
// begins at the end of this window, so no mode loses clock to it.
const INTRO_MS = 2_200;
// Callers add the time players spend elsewhere before they reach the room. A matchmade game sits
// behind a join countdown on the Play screen, so anchoring the window at creation closed it before
// anyone had arrived and the intro never played at all.
const MAX_INTRO_DELAY_MS = 10_000;

const MAX_COMPENSATION_MS = 150;
/** A bot action already this far past is discarded rather than executed - see runAlarm. */
const STALE_BOT_ACTION_MS = 250;
const MAX_BOT_ACTIONS_PER_TICK = 4;
const MAX_DEADLINES_PER_TICK = 4;
/** Fast-path in-memory tick, clamped to this range. Naturally lands near the lower bound during
 * active minigame phases and near the upper bound during the idle question phase. */
const MIN_TICK_MS = 1;
const MAX_TICK_MS = 1_000;
// A tick intentionally idling out to MAX_TICK_MS between actions is normal, not a stall - this
// must stay comfortably above MAX_TICK_MS or every idle tick logs a false-positive warning.
const STALL_WARN_MS = MAX_TICK_MS * 3;
/** A stable, persisted safety net renewed when it fires, independently of input volume. */
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
  tickDueAt: number | null = null;
  inputValidator = new InputValidator();
  mutationTail: Promise<void> = Promise.resolve();
  latency = new RoomLatency();
  terminalWork: Promise<void> | null = null;
  lastPublishedPhase: string | null = null;
  lastCheckpointedScores = "";
  lastClientMetricsAt = new Map<string, number>();
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

  private enqueueMutation<T>(work: () => Promise<T>): Promise<T> {
    const task = this.mutationTail.then(work);
    this.mutationTail = task.then(() => {}, () => {});
    return task;
  }

  async onStart() {
    this.game = (await this.ctx.storage.get<StoredGame>("game")) ?? null;
    this.scheduledAlarmAt = await this.ctx.storage.getAlarm();
    this.questionsLoaded = false;
    if (!this.game) return;

    if (this.game.privateState.netcodeVersion >= 4 && this.game.status === "active") {
      this.inputValidator = new InputValidator();
      this.game.privateState.inputEpoch = Number(this.game.privateState.inputEpoch || 1) + 1;
      syncInputState(this.game);
      for (const player of this.game.players) player.state.inputSequence = -1;
      await this.ensureQuestionsLoaded();
      await this.checkpoint(true);
    }
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

  onConnect(connection: Connection, context: ConnectionContext) {
    return this.enqueueMutation(() => this.connectPlayer(connection, context));
  }

  private async connectPlayer(connection: Connection, context: ConnectionContext) {
    const state = stateFromRequest(context.request);
    if (!this.game) return connection.close(1008, "Game not found");
    const player = this.game?.players.find((entry) => entry.userId === state.userId);
    const connectionRole = getGameConnectionRole(this.game, state.userId);
    if (!connectionRole || (state.admissionOnly && !player && this.env.STAGING_TEST_ENABLED !== "1")) return connection.close(1008, "This game cannot be spectated");
    connection.setState({ ...state, ...(state.admissionOnly ? player : {}), connectionRole, protocolVersion: state.protocolVersion });
    let spectatorStarted = false;
    if (connectionRole === "spectator") {
      const wasAlreadySpectating = [...this.getConnections<ConnectionState>()].some((candidate) => (
        candidate.id !== connection.id
        && candidate.state?.userId === state.userId
        && candidate.state?.connectionRole === "spectator"
      ));
      if (!wasAlreadySpectating) {
        this.game.chat = appendSystemChatMessage(this.game.chat as ChatMessage[], `${state.displayName} started spectating.`);
        spectatorStarted = true;
      }
    }
    if (player?.disconnectedAt != null) {
      player.disconnectedAt = null;
      await this.checkpoint(true);
    }
    await this.ensureQuestionsLoaded();
    this.emit(connection);
    if (spectatorStarted) await this.afterMutation(true);
    // A connection just appeared - shouldTick() may now be true. armTick() alone would leave the
    // durable alarm on its old (possibly much-later) precise-deadline target, so also refresh it.
    await this.scheduleNextAlarm();
    this.armTick();
  }

  onMessage(connection: Connection, raw: WSMessage) {
    const receivedAt = Date.now();
    return this.enqueueMutation(() => this.handleMessage(connection, raw, receivedAt));
  }

  private async handleMessage(connection: Connection, raw: WSMessage, receivedAt: number) {
    const message = parseMessage(raw);
    const identity = connection.state as ConnectionState;
    if (!message || !this.game || !identity?.userId) return;
    await this.ensureQuestionsLoaded();
    if (identity.connectionRole === "spectator" && !canSpectatorSendMessage(message.type)) {
      return this.sendMessage(connection, "error", { message: "Spectators cannot perform game actions." }, message.id);
    }
    if (message.type === "game.subscribe" || message.type === "game.resync") return this.emit(connection, message.id);
    if (message.type === "system.clockPing") {
      return this.sendMessage(connection, "system.clockPong", {
        clientWallTime: Number((message.payload as any)?.clientWallTime) || 0,
        clientMonotonic: Number((message.payload as any)?.clientMonotonic) || 0,
        serverReceivedAt: receivedAt,
        serverSentAt: Date.now(),
        samplingId: (message.payload as any)?.samplingId,
      }, message.id);
    }
    if (message.type === "system.rttReport") {
      const rttMs = Math.max(0, Math.min(MAX_RTT_MS, Number((message.payload as any)?.rttMs) || 0));
      const jitterMs = Math.max(0, Math.min(100, Number((message.payload as any)?.jitterMs) || 0));
      connection.setState({ ...(connection.state as ConnectionState), rttMs, jitterMs });
      if (this.game.privateState.netcodeVersion >= 4) {
        const participants = [...this.getConnections<ConnectionState>()].filter((c) => c.state?.connectionRole === "player");
        this.game.privateState.flutterGraceMs = Math.min(200, Math.max(100, ...participants.map((c) => (c.state?.rttMs ?? 160) / 2 + (c.state?.jitterMs ?? 0) + 20)));
        if (this.game.state.phase === "flutter_active") {
          // A fresh delay sample may buy the current ring more grace, but never undo a verdict
          // or bring its pending deadline forward.
          this.game.state.phaseDeadlineAt = Math.max(this.game.state.phaseDeadlineAt, Number(this.game.state.flutterCurrentRingPassAt) + this.game.privateState.flutterGraceMs);
          this.armTick();
        }
      }
      this.latency.sample("rttMs", rttMs);
      this.latency.sample("jitterMs", jitterMs);
      return;
    }
    if (message.type === "system.metricsReport") {
      const now = receivedAt;
      if (now - (this.lastClientMetricsAt.get(identity.userId) ?? 0) < 25_000) return;
      this.lastClientMetricsAt.set(identity.userId, now);
      const metrics = (message.payload ?? {}) as Record<string, unknown>;
      for (const field of ["p95AckMs", "p95UpdateMs", "p95VisualMs", "p95LocalVisualMs", "visualCorrections", "expiredActions", "resyncs"]) {
        const value = metrics[field];
        if (typeof value === "number" && value >= 0 && value <= 60_000) this.latency.sample(`client.${field}`, value);
      }
      this.reportLatency();
      return;
    }
    this.latency.sample("queueWaitMs", Date.now() - receivedAt);
    let chatDispatches: BotChatDispatch[] = [];
    let changed = false;
    if (message.type === "chat.send" || message.type === "game.chat") {
      const appended = this.addChat(identity, message.payload as any);
      if (identity.connectionRole === "player" && !identity.isBot && appended) {
        chatDispatches = scheduleBotChatReply(this.game, appended, Date.now());
      }
      changed = Boolean(appended);
    }
    else if (message.type === "game.leave") {
      this.forfeit(identity.userId);
      changed = true;
    }
    else if (receivedAt < Number(this.game.state.introEndsAt || 0)) {
      // The engine's clock has not started yet. Accepting an action here would be recorded as an
      // answer at zero elapsed time, which is the fastest possible - so the intro is also the
      // window in which an action has to be refused outright.
      this.sendMessage(connection, "game.ack", { accepted: false, reason: "intro" }, message.id);
    }
    else {
      // Receipt time owns input eligibility/scoring even when an earlier checkpoint briefly
      // occupied the mutation queue. Timers independently advance the live wall clock.
      const now = receivedAt;
      changed = await this.advanceTo(now);
      if (!this.game) return;
      syncInputState(this.game);
      const engine = this.engine();
      const isInput = ARCADE_ACTIONS.has(message.type) || message.type === "game.answer";
      const v4 = this.game.privateState.netcodeVersion >= 4 && identity.protocolVersion >= 4 && isInput;
      const validation = v4 ? this.inputValidator.validate(this.game, identity.userId, message, now) : null;
      const payload = (message.payload ?? {}) as Record<string, any>;
      if (validation && (validation.reason || validation.duplicate)) {
        const reply = validation.duplicate ?? { action: message.type, clientActionId: payload.clientActionId, sequence: payload.sequence, accepted: false, reason: validation.reason, timeErrorMs: validation.timeErrorMs };
        if (!validation.duplicate) this.inputValidator.remember(identity.userId, message, reply);
        this.sendMessage(connection, "game.actionResult", reply, message.id);
        this.latency.count(`rejected.${validation.reason ?? "duplicate"}`);
      } else {
        const before = { ...(this.game.players.find((player) => player.userId === identity.userId)?.state ?? {}) };
        const rttMs = Number((connection.state as ConnectionState)?.rttMs) || 0;
        const actionAt = validation?.at ?? now - Math.min(MAX_COMPENSATION_MS, rttMs / 2);
        const result = engine?.handleAction(this.game, identity.userId, message, this.context(now, actionAt));
        const actionChanged = Boolean(result?.changed);
        const reply = { action: message.type, clientActionId: payload.clientActionId, sequence: payload.sequence,
          accepted: actionChanged, reason: actionChanged ? undefined : "phase_or_action", ...result?.reply?.payload,
          appliedAt: actionAt, serverReceivedAt: receivedAt, inputEpoch: this.game.state.inputEpoch, roundToken: this.game.state.roundToken };
        if (v4) {
          this.inputValidator.record(identity.userId, message, reply, actionAt);
          const player = this.game.players.find((p) => p.userId === identity.userId);
          if (player) player.state.inputSequence = payload.sequence;
          changed = true;
        }
        if (actionChanged) {
          const counts = (this.game.privateState.participationByUserId ?? {}) as Record<string, number>;
          counts[identity.userId] = (Number(counts[identity.userId]) || 0) + 1;
          this.game.privateState.participationByUserId = counts;
          observeHumanAction(this.game, identity.userId, message, now, before);
          changed = true;
          if (message.type === "game.answer") {
            syncInputState(this.game);
            await this.checkpoint(true);
          }
        }
        this.sendMessage(connection, v4 ? "game.actionResult" : result?.reply?.type ?? "game.ack", v4 ? reply : result?.reply?.payload ?? { accepted: actionChanged }, message.id);
        this.latency.count(actionChanged ? "actions.accepted" : `rejected.${reply.reason}`);
      }
      this.latency.sample("processingMs", Date.now() - receivedAt);
    }
    if (!changed) return;
    ensureBotActions(this.game, Date.now());
    await this.afterMutation();
    if (chatDispatches.length) this.ctx.waitUntil(Promise.all(chatDispatches.map((dispatch) => this.dispatchBotChatJob(dispatch))));
  }

  onClose(connection: Connection) {
    return this.enqueueMutation(() => this.disconnectPlayer(connection));
  }

  private async disconnectPlayer(connection: Connection) {
    const identity = connection.state as ConnectionState;
    if (identity?.connectionRole === "spectator") {
      const isStillSpectating = [...this.getConnections<ConnectionState>()].some((candidate) => (
        candidate.state?.userId === identity.userId
        && candidate.state?.connectionRole === "spectator"
      ));
      if (!isStillSpectating && this.game) {
        this.game.chat = appendSystemChatMessage(this.game.chat as ChatMessage[], `${identity.displayName} stopped spectating.`);
        await this.afterMutation(true);
      } else {
        await this.scheduleNextAlarm();
        this.armTick();
      }
      return;
    }
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
    return this.enqueueMutation(() => this.handleRequest(body));
  }

  private async handleRequest(body: any): Promise<Response> {
    if (this.env.STAGING_TEST_ENABLED === "1" && body.type === "game.testCommand" && this.name.startsWith("load_") && this.game) {
      if (body.command === "stats") return Response.json({ status: this.game.status, settled: Boolean(this.game.privateState.resultCommitted), state: this.game.state, players: this.game.players, counters: this.latency.counters, samples: this.latency.samples });
      if (body.command === "dispose") {
        this.clearTickTimer(); this.clearBroadcastTimer();
        for (const connection of this.getConnections()) connection.close(1000, "Test complete");
        await this.ctx.storage.deleteAll(); this.game = null;
        return Response.json({ ok: true });
      }
      if (body.command === "flightWindow" && this.game.state.phase === "flutter_active") {
        this.game.state.flutterCurrentRingPassAt = Date.now() + 20_000;
        this.game.state.phaseDeadlineAt = this.game.state.flutterCurrentRingPassAt + 100;
      }
      if (body.command === "finish") this.forfeit(this.game.players[1].userId);
      if (body.command === "deadline") {
        this.engine()?.handleDeadline(this.game, this.context(Number(this.game.state.phaseDeadlineAt) || Date.now()));
        syncInputState(this.game);
      }
      await this.afterMutation(true);
      return Response.json({ ok: true });
    }
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
      state: {}, privateState: { netcodeVersion: upgradedRoom(this.name, this.env.REALTIME_V4_PERCENT) ? 4 : 3, inputEpoch: 1, locationHint: body.locationHint }, events: [], chat: [], startedAt: now, updatedAt: now,
    };
    let questions: any[];
    try {
      questions = this.env.STAGING_TEST_ENABLED === "1" && Array.isArray(body.testQuestions) ? body.testQuestions : await this.fetchQuestions(mode.id, 10);
    } catch (error) {
      this.game = null;
      return new Response(error instanceof Error ? error.message : "Unable to load questions", { status: 502 });
    }
    if (questions.length < 10) {
      this.game = null;
      return new Response(`Question provider returned ${questions.length} questions; expected 10.`, { status: 502 });
    }
    await this.storeQuestions(questions);
    // Engine clocks start at the end of the intro rather than at `now`, so every deadline the
    // engine sets already accounts for the animation.
    // Single-player modes have no opponent to introduce, so they skip the pre-roll entirely
    // rather than making one player stare at their own banner.
    const introDelayMs = Math.max(0, Math.min(MAX_INTRO_DELAY_MS, Number(body.introDelayMs) || 0));
    const introEndsAt = mode.playerCount > 1 ? now + INTRO_MS + introDelayMs : now;
    mode.createGame().initialize(this.game, questions, this.context(introEndsAt));
    if (introEndsAt > now) this.game.state.introEndsAt = introEndsAt;
    // Published so the intro banner can show "Unranked" for a player still in placement rather
    // than the Bronze I that an unearned rating of 0 would otherwise resolve to. Only the flag is
    // sent - how far through placement someone is stays private to them.
    this.game.state.placementByUserId = Object.fromEntries(this.game.players.map((player) => [
      player.userId,
      { placed: player.placementByMode?.[mode.id]?.placed ?? true },
    ]));
    if (this.env.STAGING_TEST_ENABLED === "1" && body.testExercise) {
      const testNow = Date.now();
      this.game.state.introEndsAt = testNow - 1;
      this.game.state.currentQuestionActiveAt = testNow - 1000;
      for (const player of this.game.players) mode.createGame().handleAction(this.game, player.userId, { id: `test-${player.userId}`, type: "game.answer", payload: { submittedResponse: "A" } }, this.context(testNow));
      this.game.state.phaseDeadlineAt = testNow;
      mode.createGame().handleDeadline(this.game, this.context(testNow));
    }
    syncInputState(this.game);
    this.questionsLoaded = true;
    initializeBots(this.game);
    ensureBotActions(this.game, introEndsAt);
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
  private guardedTick(source: "alarm" | "timer") {
    return this.enqueueMutation(() => this.runGuardedTick(source));
  }

  private async runGuardedTick(source: "alarm" | "timer") {
    if (source === "alarm") this.scheduledAlarmAt = null;
    if (source === "timer") this.timerTickCount += 1; else this.alarmTickCount += 1;
    this.latency.count(`ticks.${source}`);
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
    this.tickDueAt = null;
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
    if (!this.shouldTick()) { this.clearTickTimer(); return; }
    const deadlines = this.computeActiveDeadlines();
    if (!deadlines.length) { this.clearTickTimer(); return; }
    const dueAt = Math.min(...deadlines);
    const delay = Math.max(MIN_TICK_MS, Math.min(MAX_TICK_MS, dueAt - Date.now()));
    const target = Date.now() + delay;
    if (this.tickTimer != null && this.tickDueAt != null && this.tickDueAt <= target) return;
    this.clearTickTimer();
    this.tickDueAt = target;
    this.tickTimer = setTimeout(() => {
      this.latency.sample("deadlineLatenessMs", Math.max(0, Date.now() - target));
      this.tickTimer = null;
      this.tickDueAt = null;
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
    await this.advanceTo(Date.now());
    await this.afterMutation();
  }

  private async advanceTo(wall: number): Promise<boolean> {
    if (!this.game) return false;
    let changed = false;
    if (this.game.status !== "active") {
      this.startTerminalWork();
      if (this.game.privateState.expiresAt && Date.now() >= this.game.privateState.expiresAt && (this.game.privateState.resultCommitted || !this.game.result)) {
        await this.ctx.storage.deleteAll();
        this.game = null;
        return false;
      }
      return false;
    }

    const due = this.computeActiveDeadlines();
    const lateness = due.length ? Math.max(0, wall - Math.min(...due)) : 0;
    this.simNow = Math.max(this.simNow, wall);
    if (lateness > STALL_WARN_MS) {
      console.warn(`[GameServer:${this.name}] tick stalled ${lateness}ms (phase=${this.game.state.phase})`);
    }

    expireBotChatJobs(this.game, this.simNow);
    const disconnected = this.game.players.find((player) => player.disconnectedAt && this.simNow - player.disconnectedAt >= DISCONNECT_GRACE_MS);
    if (disconnected) {
      this.forfeit(disconnected.userId);
      return true;
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
        changed = true;
        syncInputState(this.game);
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
          changed = true;
          continue;
        }
        if (executed >= MAX_BOT_ACTIONS_PER_TICK) break;
        if (!runNextBotAction(this.game, engine, this.context(botDeadline), this.simNow)) break;
        executed += 1;
        changed = true;
      }
      if (dropped) {
        console.warn(`[GameServer:${this.name}] dropped ${dropped} stale bot action(s) after a ${lateness}ms stall`);
      }
    }

    return changed;
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
    this.latency.count("storage.checkpoint");
    const started = Date.now();
    await this.ctx.storage.put("game", value);
    this.latency.sample("storageMs", Date.now() - started);
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
    const values: Record<string, Uint8Array> = {};
    for (const [questionIndex, question] of questions.entries()) {
      const chunks = encodeQuestionChunks(question);
      const keys = chunks.map((_, chunkIndex) => `question:${questionIndex}:${chunkIndex}`);
      chunks.forEach((chunk, index) => { values[keys[index]] = chunk; });
      questionStorageKeys.push(keys);
    }
    // The provider is capped at ten questions; all chunk values commit together.
    await this.ctx.storage.put(values);
    this.game.privateState.questionStorageKeys = questionStorageKeys;
  }

  /** Checkpoint semantic changes and publish independently of external settlement work. */
  private async afterMutation(forceCheckpoint = false) {
    if (!this.game) return;
    this.game.updatedAt = Date.now();
    if (this.game.status !== "active" && !this.game.privateState.expiresAt) this.game.privateState.expiresAt = Date.now() + 15 * 60_000;
    await this.ensureQuestionsLoaded();
    syncInputState(this.game);
    const phase = String(this.game.state.phase ?? "");
    const immediate = this.lastPublishedPhase !== phase || this.game.status !== "active";
    if (this.game.status !== "active") this.game.privateState.terminalRetryAt ??= Date.now() + 10_000;
    await this.checkpoint(forceCheckpoint);
    this.scheduleBroadcast();
    if (immediate) { this.clearBroadcastTimer(); this.flushBroadcast(); }
    if (this.game.status !== "active") this.startTerminalWork();
    this.reportLatency();
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
    if (JSON.stringify(this.game.players.map((p) => p.state.score)) !== this.lastCheckpointedScores) return true;
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
    this.lastCheckpointedScores = JSON.stringify(this.game.players.map((p) => p.state.score));
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
    const interval = /^(timber|puncture|flutter)_active$/.test(String(this.game.state.phase)) ? 50 : MIN_BROADCAST_INTERVAL_MS;
    const delay = Math.max(0, interval - (Date.now() - this.lastBroadcastAt));
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
    this.lastPublishedPhase = String(this.game.state.phase ?? "");
    this.latency.count("broadcasts");
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
      if (Number(connection.state?.protocolVersion) >= PATCH_PROTOCOL_VERSION) {
        this.sendMessage(connection, "game.update", { room: patch?.room, players: patch?.players, events: newEvents, chat: newChat });
      } else {
        cachedSnapshot ??= this.snapshot();
        this.sendMessage(connection, "game.snapshot", cachedSnapshot);
      }
    }
  }

  private reportLatency(force = false) {
    if (!this.game || !force && !upgradedRoom(this.name, this.env.REALTIME_METRICS_PERCENT ?? "10")) return;
    this.latency.report(this.name, this.game.modeId, this.game.privateState.netcodeVersion ?? 3, this.env.BUILD_ID ?? "local", force, { status: this.game.status, settled: Boolean(this.game.privateState.resultCommitted), sessionsReleased: Boolean(this.game.privateState.playerSessionsReleased), endedAt: this.game.result?.endedAt, region: this.game.privateState.locationHint });
  }

  private startTerminalWork() {
    if (!this.game || this.game.status === "active" || this.terminalWork) return;
    if (this.game.privateState.playerSessionsReleased && (!this.game.result || this.game.privateState.resultCommitted)) return;
    this.game.privateState.terminalRetryAt = Date.now() + 10_000;
    const work = Promise.allSettled([this.releasePlayerSessions(), this.commitResult()]).then(async (results) => {
      for (const result of results) if (result.status === "rejected") {
        this.latency.count("terminal.failed");
        console.warn(`[GameServer:${this.name}] settlement/release will retry`, result.reason instanceof Error ? result.reason.message : "request failed");
      }
      await this.enqueueMutation(async () => {
        if (!this.game) return;
        await this.save();
        await this.scheduleNextAlarm();
        this.reportLatency(true);
      });
    }).catch((error) => console.error("Terminal work failed", error)).finally(() => { this.terminalWork = null; });
    this.terminalWork = work;
    this.ctx.waitUntil(work);
  }

  private async releasePlayerSessions() {
    if (!this.game || this.game.status === "active" || this.game.privateState.playerSessionsReleased) return;
    const results = await Promise.allSettled(this.game.players.filter((player) => !player.isBot).map(async (player) => {
      const response = await requestRoom(this.env.USER, player.userId, { type: "game.finished", gameId: this.game!.gameId }, undefined, 5_000);
      if (!response.ok) throw new Error(`Unable to release ${player.userId}: ${response.status}`);
    }));
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      console.warn("Unable to release one or more finished game sessions.", { gameId: this.game.gameId, failed: failed.length });
      return;
    }
    await this.enqueueMutation(async () => { if (this.game) this.game.privateState.playerSessionsReleased = true; });
  }

  private async scheduleNextAlarm() {
    if (!this.game) return;
    let next: number | null;
    if (this.game.status === "active" && this.shouldTick()) {
      // The fast timer (armTick) is doing the real scheduling; this alarm is purely a backstop.
      if (this.scheduledAlarmAt != null && this.scheduledAlarmAt > Date.now() && this.scheduledAlarmAt <= Date.now() + BACKSTOP_ALARM_MS) return;
      next = Date.now() + BACKSTOP_ALARM_MS;
    } else if (this.game.status === "active") {
      // No one connected to tick fast for - wake exactly when something could matter instead
      // (typically a disconnect-grace timeout).
      const deadlines = this.computeActiveDeadlines();
      next = deadlines.length ? Math.min(...deadlines) : null;
    } else {
      const deadlines = [(this.game.result && !this.game.privateState.resultCommitted) || !this.game.privateState.playerSessionsReleased ? (this.game.privateState.terminalRetryAt ?? Date.now() + 10_000) : null, this.game.privateState.expiresAt ?? null]
        .filter((value): value is number => Boolean(value));
      next = deadlines.length ? Math.min(...deadlines) : null;
    }
    if (next === this.scheduledAlarmAt) return;
    if (next == null) await this.ctx.storage.deleteAlarm();
    else {
      this.latency.count("storage.alarm");
      await this.ctx.storage.setAlarm(next);
    }
    this.scheduledAlarmAt = next;
  }

  private addChat(identity: ConnectionState, payload: { text?: string; clientMessageId?: string }): ChatMessage | null {
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
    await this.enqueueMutation(async () => {
      if (this.game && failBotChatGeneration(this.game, dispatch.botUserId, dispatch.jobId, dispatch.revision)) await this.afterMutation();
    });
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
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Question provider failed (${response.status}): ${await response.text()}`);
    return (await response.json() as { questions?: any[] }).questions ?? [];
  }

  private async commitResult() {
    if (!this.game?.result || this.game.privateState.resultCommitted) return;
    let saved: { eloDeltaByUserId?: Record<string, number>; rewardsByUserId?: Record<string, { xp: number; lumen: number }>; questsByUserId?: Record<string, unknown> };
    if (this.env.STAGING_TEST_ENABLED === "1") {
      saved = { rewardsByUserId: Object.fromEntries(this.game.players.filter((p) => !p.isBot).map((p) => [p.userId, { xp: 0, lumen: 0 }])) };
    } else {
      if (!this.env.BACKEND_API_BASE_URL) return;
      const response = await fetch(`${this.env.BACKEND_API_BASE_URL}/realtime/results`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.env.REALTIME_ACTIVITY_SECRET ?? ""}` },
        signal: AbortSignal.timeout(5_000),
        body: JSON.stringify({ ...this.game.result, participationByUserId: this.game.privateState.participationByUserId ?? {}, botPlayerIds: this.game.players.filter((player) => player.isBot).map((player) => player.userId) }),
      });
      if (!response.ok) { this.latency.count("terminal.failed"); console.warn("Result commit will retry", { status: response.status, roomId: this.name }); return; }
      saved = await response.json();
    }
    await this.enqueueMutation(async () => {
      if (!this.game) return;
      const endedEvent = [...this.game.events].reverse().find((event) => event.type === "GAME_ENDED");
      if (endedEvent) {
        // The rewards the backend actually granted ride along on the end event so
        // the client can animate exactly what was awarded.
        endedEvent.data = {
          ...endedEvent.data,
          ...(saved.eloDeltaByUserId ? { eloDeltaByUserId: saved.eloDeltaByUserId } : {}),
          ...(saved.rewardsByUserId ? { rewardsByUserId: saved.rewardsByUserId } : {}),
          ...(saved.questsByUserId ? { questsByUserId: saved.questsByUserId } : {}),
        };
      }
      this.game.privateState.resultCommitted = true;
      await this.save();
      const snapshot = this.snapshot();
      for (const connection of this.getConnections()) this.sendMessage(connection, "game.snapshot", snapshot);
    });
  }
}

export default GameServer;
