import { env, exports } from "cloudflare:workers";
import { reset, runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleBotChatReply } from "./bots/controller";
import type { ChatMessage } from "./chat";
import { decodeQuestionChunks, encodeQuestionChunks } from "./question-storage";
import type { BotChatServer } from "./servers/bot-chat";
import type { GameServer } from "./servers/game";
import type { MatchmakerServer } from "./servers/matchmaker";

const runtimeEnv = env as Env;

const questions = Array.from({ length: 10 }, (_, index) => ({
  id: `question-${index}`,
  prompt: index === 0 ? "x".repeat(270_000) : "A smaller question",
  questionType: "mcq",
  difficulty: "Medium",
  choices: [{ id: "A", label: "Answer" }],
  correctAnswer: "A",
}));

const mockExternalServices = () => vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === "https://backend.test" && url.pathname === "/realtime/auth/verify") {
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    if (headers.get("Authorization") !== "Bearer valid") {
      return new Response("Invalid token", { status: 401 });
    }
    return Response.json({
      userId: "user-1",
      displayName: "Player One",
      profilePicture: null,
      avatar: null,
      eloByMode: {},
    });
  }
  if (url.origin === "https://backend.test" && url.pathname === "/realtime/questions") {
    return Response.json({ questions });
  }
  if (url.origin === "https://backend.test" && url.pathname === "/realtime/results") {
    return Response.json({ ok: true, duplicate: false, eloDeltaByUserId: {} });
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
    expect(await health.json()).toEqual({ ok: true, service: "studium-realtime" });

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
