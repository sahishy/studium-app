import type * as Party from "partykit/server";
import { appendChatMessage, type ChatMessage } from "../chat";
import type { GameContext, StoredGame } from "../games/contracts";
import { getGameMode } from "../games/registry";
import type { PartyEnv, PlayerIdentity } from "../types";
import { makeId, parseMessage, send, stateFromRequest, verifyConnection } from "../utils";
import { decodeQuestionChunks, encodeQuestionChunks } from "../question-storage";
import {
  beginBotChatGeneration,
  completeBotChatGeneration,
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

export default class GameServer implements Party.Server {
  game: StoredGame | null = null;
  constructor(readonly room: Party.Room) {}

  static onBeforeConnect(request: Party.Request, lobby: Party.Lobby) { return verifyConnection(request, lobby.env as PartyEnv); }
  async onStart() {
    this.game = (await this.room.storage.get<StoredGame>("game")) ?? null;
    if (!this.game) return;

    const embeddedQuestions = this.embeddedQuestions();
    const questionStorageKeys = this.game.privateState.questionStorageKeys as string[][] | undefined;
    if (questionStorageKeys?.length) {
      const questions = await Promise.all(questionStorageKeys.map(async (keys) => {
        const chunks = await Promise.all(keys.map((key) => this.room.storage.get<Uint8Array>(key)));
        if (chunks.some((chunk) => !chunk)) throw new Error("Stored game question is missing.");
        return decodeQuestionChunks(chunks as Uint8Array[]);
      }));
      this.attachQuestions(questions);
    } else if (embeddedQuestions.length) {
      // Migrate games created before questions were split out of the main game value.
      await this.storeQuestions(embeddedQuestions);
      await this.save();
    }
    initializeBots(this.game);
    ensureBotActions(this.game, Date.now());
    await this.save();
    await this.scheduleNextAlarm();
  }

  async onConnect(connection: Party.Connection, context: Party.ConnectionContext) {
    const state = stateFromRequest(context.request);
    connection.setState(state);
    const player = this.game?.players.find((entry) => entry.userId === state.userId);
    if (!player) return connection.close(1008, "Not a player in this game");
    player.disconnectedAt = null;
    await this.save();
    this.emit(connection);
  }

  async onMessage(raw: string | ArrayBuffer, connection: Party.Connection) {
    const message = parseMessage(raw);
    const identity = connection.state as PlayerIdentity;
    if (!message || !this.game || !identity?.userId) return;
    if (message.type === "game.subscribe") return this.emit(connection, message.id);
    let chatDispatches: BotChatDispatch[] = [];
    if (message.type === "chat.send" || message.type === "game.chat") {
      const appended = this.addChat(identity, message.payload as any);
      if (!identity.isBot && appended) chatDispatches = scheduleBotChatReply(this.game, appended, Date.now());
    }
    else if (message.type === "game.leave") {
      this.forfeit(identity.userId);
      await this.room.context.parties.user.get(identity.userId).fetch({ method: "POST", body: JSON.stringify({ type: "game.finished", gameId: this.room.id }) });
    }
    else {
      const engine = this.engine();
      const now = Date.now();
      const deadline = engine?.nextDeadline(this.game) ?? null;
      if (engine && deadline && now >= deadline) {
        engine.handleDeadline(this.game, this.context(now));
      } else {
        const before = { ...(this.game.players.find((player) => player.userId === identity.userId)?.state ?? {}) };
        engine?.handleAction(this.game, identity.userId, message, this.context(now));
        observeHumanAction(this.game, identity.userId, message, now, before);
      }
    }
    ensureBotActions(this.game, Date.now());
    await this.afterMutation();
    if (chatDispatches.length) await Promise.all(chatDispatches.map((dispatch) => this.dispatchBotChatJob(dispatch)));
  }

  async onClose(connection: Party.Connection) {
    const identity = connection.state as PlayerIdentity;
    const player = this.game?.players.find((entry) => entry.userId === identity?.userId);
    const stillConnected = [...this.room.getConnections()].some((candidate) => (candidate.state as PlayerIdentity)?.userId === identity?.userId);
    if (!stillConnected && player && this.game?.status === "active") {
      player.disconnectedAt = Date.now();
      await this.afterMutation();
    }
  }

  async onRequest(request: Party.Request) {
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
    if (this.game) return Response.json({ ok: true, gameId: this.room.id });
    const mode = getGameMode(body.modeId);
    if (!mode || body.players?.length !== mode.playerCount) return new Response("Invalid game configuration", { status: 400 });
    const now = Date.now();
    this.game = {
      gameId: this.room.id, modeId: mode.id, ranked: Boolean(body.ranked), status: "active",
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
    initializeBots(this.game);
    ensureBotActions(this.game, now);
    await this.afterMutation();
    return Response.json({ ok: true, gameId: this.room.id });
  }

  async onAlarm() {
    if (!this.game) return;
    if (this.game.status !== "active") {
      if (this.game.result && !this.game.privateState.resultCommitted) await this.commitResult();
      if (this.game.privateState.expiresAt && Date.now() >= this.game.privateState.expiresAt && (this.game.privateState.resultCommitted || !this.game.result)) {
        await this.room.storage.deleteAll();
        this.game = null;
        return;
      }
      await this.scheduleNextAlarm();
      return;
    }
    const now = Date.now();
    expireBotChatJobs(this.game, now);
    const disconnected = this.game.players.find((player) => player.disconnectedAt && now - player.disconnectedAt >= DISCONNECT_GRACE_MS);
    if (disconnected) this.forfeit(disconnected.userId);
    else {
      const engine = this.engine();
      if (engine) {
        for (let count = 0; count < 64 && this.game.status === "active"; count += 1) {
          ensureBotActions(this.game, Math.min(now, Number(this.game.updatedAt) || now));
          const gameDeadline = engine.nextDeadline(this.game);
          const botDeadline = nextBotDeadline(this.game);
          const dueAt = [gameDeadline, botDeadline].filter((value): value is number => value != null).sort((a, b) => a - b)[0];
          if (dueAt == null || dueAt > now) break;
          if (gameDeadline != null && gameDeadline <= (botDeadline ?? Number.POSITIVE_INFINITY)) {
            engine.handleDeadline(this.game, this.context(gameDeadline));
            ensureBotActions(this.game, gameDeadline);
          } else if (!runNextBotAction(this.game, engine, this.context(botDeadline!))) break;
        }
      }
    }
    await this.afterMutation();
  }

  private engine() { return this.game ? getGameMode(this.game.modeId)?.createGame() ?? null : null; }
  private context(now = Date.now()): GameContext {
    return {
      now,
      addEvent: (type, data = {}, actorUserId = null) => {
        if (!this.game) return;
        this.game.events.push({ uid: makeId("event"), type, modeId: this.game.modeId, actorUserId, sequence: this.game.events.length + 1, data, createdAt: now });
      },
    };
  }

  private snapshot() {
    if (!this.game) return null;
    const engine = this.engine();
    return {
      room: { uid: this.game.gameId, modeId: this.game.modeId, ranked: this.game.ranked, status: this.game.status === "active" ? "active" : "finished", state: engine?.publicState(this.game) ?? this.game.state },
      players: this.game.players.map(({ disconnectedAt, isBot: _isBot, ...player }) => player),
      events: this.game.events,
      chat: this.game.chat,
    };
  }

  private emit(connection: Party.Connection, id = makeId()) { send(connection, "game.snapshot", this.snapshot(), id); }
  private async save() {
    if (!this.game) return;
    const privateState = { ...this.game.privateState };
    delete privateState.questions;
    delete privateState.questionsById;
    await this.room.storage.put("game", { ...this.game, privateState });
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
      await Promise.all(chunks.map((chunk, chunkIndex) => this.room.storage.put(keys[chunkIndex], chunk)));
      questionStorageKeys.push(keys);
    }
    this.game.privateState.questionStorageKeys = questionStorageKeys;
  }

  private async afterMutation() {
    if (!this.game) return;
    this.game.updatedAt = Date.now();
    if (this.game.status !== "active" && !this.game.privateState.expiresAt) this.game.privateState.expiresAt = Date.now() + 15 * 60_000;
    await this.releasePlayerSessions();
    await this.save();
    this.room.broadcast(JSON.stringify({ id: makeId(), type: "game.snapshot", payload: this.snapshot() }));
    if (this.game.result) await this.commitResult();
    await this.scheduleNextAlarm();
  }

  private async releasePlayerSessions() {
    if (!this.game || this.game.status === "active" || this.game.privateState.playerSessionsReleased) return;
    const results = await Promise.allSettled(this.game.players.filter((player) => !player.isBot).map(async (player) => {
      const response = await this.room.context.parties.user.get(player.userId).fetch({
        method: "POST",
        body: JSON.stringify({ type: "game.finished", gameId: this.game!.gameId }),
      });
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
    const deadlines = this.game.status === "active"
      ? [this.engine()?.nextDeadline(this.game) ?? null, nextBotDeadline(this.game), nextBotChatExpiry(this.game), ...this.game.players.filter((player) => !player.isBot).map((player) => player.disconnectedAt ? player.disconnectedAt + DISCONNECT_GRACE_MS : null)]
      : [this.game.result && !this.game.privateState.resultCommitted ? Date.now() + 10_000 : null, this.game.privateState.expiresAt ?? null];
    const concreteDeadlines = deadlines.filter((value): value is number => Boolean(value));
    if (concreteDeadlines.length) await this.room.storage.setAlarm(Math.min(...concreteDeadlines));
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
      response = await this.room.context.parties.botchat.get(dispatch.gameId).fetch({
        method: "POST",
        body: JSON.stringify({ type: "bot.chatSchedule", ...dispatch }),
      });
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
    const env = this.room.env as PartyEnv;
    if (!env.BACKEND_API_BASE_URL) return [];
    const response = await fetch(`${env.BACKEND_API_BASE_URL}/realtime/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modeId, count }),
    });
    if (!response.ok) throw new Error(`Question provider failed (${response.status}): ${await response.text()}`);
    return (await response.json() as { questions?: any[] }).questions ?? [];
  }

  private async commitResult() {
    if (!this.game?.result || this.game.privateState.resultCommitted) return;
    const env = this.room.env as PartyEnv;
    if (!env.BACKEND_API_BASE_URL) return;
    const response = await fetch(`${env.BACKEND_API_BASE_URL}/realtime/results`, {
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
    this.room.broadcast(JSON.stringify({ id: makeId(), type: "game.snapshot", payload: this.snapshot() }));
  }
}
