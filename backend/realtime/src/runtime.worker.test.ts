import { OrderedLink } from "../scripts/ordered-link";
import { env, exports } from "cloudflare:workers";
import { reset, runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleBotChatReply } from "./bots/controller";
import type { ChatMessage } from "./chat";
import { decodeQuestionChunks, encodeQuestionChunks } from "./question-storage";
import type { BotChatServer } from "./servers/bot-chat";
import type { GameServer } from "./servers/game";
import type { MatchmakerServer } from "./servers/matchmaker";
import type { UserServer } from "./servers/user";

const runtimeEnv = env as Env;

const questions = Array.from({ length: 10 }, (_, index) => ({
  id: `question-${index}`,
  prompt: index === 0 ? "x".repeat(270_000) : "A smaller question",
  questionType: "mcq",
  difficulty: "Medium",
  choices: [{ id: "A", label: "Answer" }],
  correctAnswer: "A",
}));

const mockExternalServices = (questionSet = questions) => vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === "https://backend.test" && url.pathname === "/realtime/auth/verify") {
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    const token = headers.get("Authorization")?.replace(/^Bearer\s+/, "");
    if (token !== "valid" && token !== "viewer") {
      return new Response("Invalid token", { status: 401 });
    }
    return Response.json({
      userId: token === "viewer" ? "viewer-1" : "user-1",
      displayName: token === "viewer" ? "Match Viewer" : "Player One",
      profilePicture: null,
      avatar: null,
      eloByMode: {},
    });
  }
  if (url.origin === "https://backend.test" && url.pathname === "/realtime/questions") {
    return Response.json({ questions: questionSet });
  }
  if (url.origin === "https://backend.test" && url.pathname === "/realtime/results") {
    return Response.json({ ok: true, duplicate: false, eloDeltaByUserId: {} });
  }
  if (url.origin === "https://backend.test" && url.pathname === "/realtime/activity") {
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    if (headers.get("Authorization") !== "Bearer test-activity-secret") return new Response("Unauthorized", { status: 401 });
    return Response.json({ updated: 1 });
  }
  if (url.origin === "https://api.openai.com" && url.pathname === "/v1/responses") {
    return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "gg" }] }] });
  }
  throw new Error(`Unexpected external request: ${url}`);
});

const internalPost = (body: unknown, url = "https://internal.invalid/command") => new Request(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("Worker routing", () => {
  it("serves health and rejects externally routed room commands", async () => {
    const health = await exports.default.fetch(new Request("https://realtime.test/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      ok: true,
      service: "studium-realtime",
      activityPublishingConfigured: true,
    });

    const command = await exports.default.fetch(internalPost(
      { type: "game.initialize" },
      "https://realtime.test/parties/game/public",
    ));
    expect(command.status).toBe(404);
  });

  it("rejects missing auth and accepts a verified user WebSocket", async () => {
    mockExternalServices();
    const missing = await exports.default.fetch(new Request(
      "https://realtime.test/parties/user/user-1",
      { headers: { Upgrade: "websocket" } },
    ));
    expect(missing.status).toBe(401);

    const invalid = await exports.default.fetch(new Request(
      "https://realtime.test/parties/user/user-1?token=invalid",
      { headers: { Upgrade: "websocket" } },
    ));
    expect(invalid.status).toBe(401);

    const connected = await exports.default.fetch(new Request(
      "https://realtime.test/parties/user/user-1?token=valid",
      { headers: { Upgrade: "websocket" } },
    ));
    expect(connected.status).toBe(101);
    connected.webSocket?.accept();
    connected.webSocket?.close(1000, "test complete");
  });
});

describe("Durable realtime state", () => {
  it("measures acknowledgements and authoritative updates over ordered impaired links", async () => {
    mockExternalServices(Array.from({ length: 10 }, (_, index) => ({ id: `benchmark-q${index}`, prompt: "Choose A", questionType: "mcq", difficulty: "Medium", choices: [{ id: "A", label: "A" }], correctAnswer: "A" })));
    const measurements: Array<Record<string, unknown>> = [];
    for (const mode of ["sat-classic", "sat-timber", "sat-puncture", "sat-flutter"]) {
      for (const profile of [{ rttMs: 40, jitterMs: 0 }, { rttMs: 120, jitterMs: 30 }, { rttMs: 250, jitterMs: 50 }]) {
        const gameId = `latency-${mode}-${profile.rttMs}`, stub = runtimeEnv.GAME.getByName(gameId);
        await stub.fetch(internalPost({ type: "game.initialize", modeId: mode, ranked: true,
          players: ["user-1", "user-2"].map((userId) => ({ userId, displayName: userId, profilePicture: null })) }));
        await runInDurableObject(stub, (instance: GameServer) => {
          instance.game!.state.currentQuestionActiveAt = Date.now() - 1000;
          instance.game!.state.introEndsAt = Date.now() - 1000;
        });
        const response = await exports.default.fetch(new Request(`https://realtime.test/parties/game/${gameId}?token=valid&protocolVersion=3`, { headers: { Upgrade: "websocket" } }));
        const socket = response.webSocket!; socket.accept();
        const up = new OrderedLink(() => profile), down = new OrderedLink(() => profile);
        const id = `answer-${mode}-${profile.rttMs}`, started = Date.now();
        let ackMs: number | undefined, updateMs: number | undefined;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error(`No acknowledgement/update: ${gameId}`)), 3000);
          socket.addEventListener("message", (event) => down.send(() => {
            const m = JSON.parse(String(event.data));
            if (m.id === id && m.type === "game.ack") { expect(m.payload.accepted).toBe(true); ackMs = Date.now() - started; }
            if (m.type === "game.update" && m.payload.players?.["user-1"]?.answeredQuestionIds?.length) updateMs = Date.now() - started;
            if (ackMs != null && updateMs != null) { clearTimeout(timeout); resolve(); }
          }));
          up.send(() => socket.send(JSON.stringify({ id, type: "game.answer", payload: { submittedResponse: "A" } })));
        });
        expect(ackMs!).toBeGreaterThanOrEqual(profile.rttMs - profile.jitterMs * 2 - 5);
        expect(updateMs!).toBeLessThan(profile.rttMs + profile.jitterMs * 2 + 500);
        measurements.push({ mode, ...profile, ackMs, updateMs });
        up.close(); down.close(); socket.close(1000);
      }
    }
    console.info("Ordered-link local Worker samples (real traffic delayed both directions)", measurements);
  });

  it("announces when a spectator starts and stops spectating", async () => {
    mockExternalServices();
    const gameId = "spectator-presence-game";
    const gameStub = runtimeEnv.GAME.getByName(gameId);
    const initialized = await gameStub.fetch(internalPost({
      type: "game.initialize",
      modeId: "sat-classic",
      ranked: false,
      players: [
        { userId: "user-1", displayName: "Player One", profilePicture: null },
        { userId: "user-2", displayName: "Player Two", profilePicture: null },
      ],
    }));
    expect(initialized.status).toBe(200);

    const connected = await exports.default.fetch(new Request(
      `https://realtime.test/parties/game/${gameId}?token=viewer`,
      { headers: { Upgrade: "websocket" } },
    ));
    expect(connected.status).toBe(101);
    connected.webSocket?.accept();

    await vi.waitFor(async () => {
      await runInDurableObject(gameStub, async (instance: GameServer) => {
        expect(instance.game?.chat.at(-1)).toMatchObject({
          senderName: "System",
          text: "Match Viewer started spectating.",
          system: true,
        });
      });
    });

    connected.webSocket?.close(1000, "stopped spectating");
    await vi.waitFor(async () => {
      await runInDurableObject(gameStub, async (instance: GameServer) => {
        expect(instance.game?.chat.at(-1)).toMatchObject({
          senderName: "System",
          text: "Match Viewer stopped spectating.",
          system: true,
        });
      });
    });
  });

  it("publishes an assigned player's in-game activity with the room id", async () => {
    const fetchMock = mockExternalServices();
    const userStub = runtimeEnv.USER.getByName("user-1");
    const response = await userStub.fetch(internalPost({
      type: "game.assigned",
      modeId: "sat-timber",
      gameId: "game-123",
    }));
    expect(response.status).toBe(200);

    await runInDurableObject(userStub, async (instance: UserServer) => {
      expect(instance.state.status).toBe("in_room");
      expect(instance.state.currentRoomId).toBe("game-123");
    });

    const activityCall = fetchMock.mock.calls.find(([input]) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      return url.pathname === "/realtime/activity";
    });
    expect(activityCall).toBeTruthy();
    expect(JSON.parse(String(activityCall?.[1]?.body))).toEqual({
      updates: [{
        userId: "user-1",
        activity: { state: "in_game", modeId: "sat-timber", roomId: "game-123" },
      }],
    });
  });

  it("flushes final game results before releasing the player's session", async () => {
    mockExternalServices();
    const stub = runtimeEnv.GAME.getByName("finish-order");
    await stub.fetch(internalPost({
      type: "game.initialize",
      modeId: "sat-classic",
      ranked: false,
      players: [
        { userId: "user-1", displayName: "Human", profilePicture: null },
        { userId: "bot", displayName: "Bot", profilePicture: null, isBot: true },
      ],
    }));

    await runInDurableObject(stub, async (instance: GameServer) => {
      const lifecycle = instance as unknown as {
        forfeit(userId: string): void;
        afterMutation(): Promise<void>;
        releasePlayerSessions(): Promise<void>;
        lastBroadcastView: { room: { status: string; phase: string } };
        broadcastTimer: unknown;
      };
      const release = vi.spyOn(lifecycle, "releasePlayerSessions").mockImplementation(async () => {
        expect(lifecycle.lastBroadcastView.room).toMatchObject({ status: "finished", phase: "finished" });
        expect(lifecycle.broadcastTimer).toBeNull();
      });
      lifecycle.forfeit("bot");
      await lifecycle.afterMutation();
      expect(release).toHaveBeenCalledOnce();
      expect(instance.game?.events.some((event) => event.type === "GAME_ENDED")).toBe(true);
    });
  });

  it("stores oversized questions in chunks and restores them after startup", async () => {
    mockExternalServices();
    const stub = runtimeEnv.GAME.getByName("large-game");
    const response = await stub.fetch(internalPost({
      type: "game.initialize",
      modeId: "sat-classic",
      ranked: false,
      players: [
        { userId: "p1", displayName: "One", profilePicture: null },
        { userId: "p2", displayName: "Two", profilePicture: null },
      ],
    }));
    expect(response.status).toBe(200);

    await runInDurableObject(stub, async (instance: GameServer, state: DurableObjectState) => {
      const stored = await state.storage.get<any>("game");
      expect(JSON.stringify(stored).length).toBeLessThan(131_072);
      expect(stored.privateState.questionsById).toBeUndefined();
      expect(instance.game?.privateState.questionsById["question-0"].prompt.length).toBe(270_000);
    });

    const encoded = encodeQuestionChunks(questions[0]);
    expect(encoded.length).toBeGreaterThan(1);
    expect(decodeQuestionChunks(encoded)).toEqual(questions[0]);
  });

  it("uses a Durable Object alarm to fill a stale matchmaking entry", async () => {
    mockExternalServices();
    const stub = runtimeEnv.MATCHMAKER.getByName("sat-classic");
    const joinedAt = Date.now();
    const response = await stub.fetch(internalPost({
      type: "queue.join",
      requesterUserId: "user-1",
      entry: {
        id: "user-1",
        userIds: ["user-1"],
        players: [{ userId: "user-1", displayName: "One", profilePicture: null, elo: 500 }],
        averageElo: 500,
        joinedAt,
      },
    }));
    expect(response.status).toBe(200);

    await runInDurableObject(stub, async (instance: MatchmakerServer, state: DurableObjectState) => {
      instance.queue[0].joinedAt = Date.now() - 60_000;
      instance.queue[0].botFillAt = Date.now() - 1;
      await state.storage.put("queue", instance.queue);
      await instance.alarm();
    });

    await runInDurableObject(stub, async (instance: MatchmakerServer) => {
      expect(instance.queue).toHaveLength(0);
    });
  });

  it("runs an isolated bot-chat job and calls back through the GAME binding", async () => {
    mockExternalServices();
    const gameId = "bot-game";
    const gameStub = runtimeEnv.GAME.getByName(gameId);
    const initialized = await gameStub.fetch(internalPost({
      type: "game.initialize",
      modeId: "sat-classic",
      ranked: false,
      players: [
        { userId: "human", displayName: "Human", profilePicture: null },
        { userId: "bot", displayName: "Bot", profilePicture: null, isBot: true },
      ],
    }));
    expect(initialized.status).toBe(200);

    const dispatch = await runInDurableObject(gameStub, async (instance: GameServer, state: DurableObjectState) => {
      const message: ChatMessage = {
        uid: "human-message",
        userId: "human",
        senderName: "Human",
        text: "hello",
        createdAt: Date.now() - 2_000,
      };
      instance.game!.chat.push(message);
      const [job] = scheduleBotChatReply(instance.game!, message, Date.now() - 2_000);
      await state.storage.put("game", instance.game);
      return job;
    });
    expect(dispatch).toBeTruthy();

    const chatStub = runtimeEnv.BOTCHAT.getByName(gameId);
    const scheduled = await chatStub.fetch(internalPost({ type: "bot.chatSchedule", ...dispatch }));
    expect(scheduled.status).toBe(200);
    await runInDurableObject(gameStub, async (instance: GameServer, state: DurableObjectState) => {
      instance.game!.privateState.botRuntimes[dispatch!.botUserId].chat.pending!.debounceAt = 0;
      await state.storage.put("game", instance.game);
    });
    await runInDurableObject(chatStub, async (instance: BotChatServer, state: DurableObjectState) => {
      const job = await state.storage.get<any>("job");
      job.dueAt = 0;
      await state.storage.put("job", job);
      await instance.alarm();
    });

    await runInDurableObject(chatStub, async (_instance: BotChatServer, state: DurableObjectState) => {
      expect(await state.storage.get("job")).toBeUndefined();
    });
    await runInDurableObject(gameStub, async (instance: GameServer) => {
      const runtime = instance.game!.privateState.botRuntimes[dispatch!.botUserId];
      expect(runtime.chat.pending.status).toBe("typing");
      expect(runtime.scheduled.some((action: any) => action.kind === "chat_send" && action.text === "gg")).toBe(true);
    });
  });
});
