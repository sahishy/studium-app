import assert from "node:assert/strict";
import test from "node:test";
import BotChatServer from "./bot-chat.ts";
import { BOT_CHAT_MODEL } from "../bots/chat.ts";

const createStorage = () => {
  const values = new Map();
  return {
    alarm: null,
    async get(key) { return values.get(key); },
    async put(key, value) { values.set(key, value); },
    async setAlarm(at) { this.alarm = at; },
    async deleteAll() { values.clear(); this.alarm = null; },
  };
};

test("isolated bot-chat room validates, generates, calls back, and cleans up", async () => {
  const storage = createStorage();
  const gameRequests = [];
  const room = {
    id: "game-1", storage, env: { OPENAI_API_KEY: "secret", PARTYKIT_HOST: "https://realtime.test" },
    context: { get parties() { throw new Error("alarms must not access cross-party stubs"); } },
  };
  const server = new BotChatServer(room);
  const originalFetch = globalThis.fetch;
  let apiBody;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url) === "https://api.openai.com/v1/responses") {
      apiBody = body;
      return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "yo" }] }] });
    }
    assert.equal(String(url), "https://realtime.test/parties/game/game-1");
    gameRequests.push(body);
    if (body.type === "bot.chatContext") {
      return Response.json({
        request: {
          displayName: "Bot", modeName: "Classic", modeContext: "SAT match", standing: "TIED", messages: ["yo"],
        },
      });
    }
    return Response.json({ ok: true });
  };
  try {
    const dueAt = Date.now() - 1;
    const response = await server.onRequest(new Request("https://bot-chat.test", {
      method: "POST",
      body: JSON.stringify({ type: "bot.chatSchedule", gameId: "game-1", botUserId: "bot", jobId: "opaque-job", revision: 1, dueAt }),
    }));
    assert.equal(response.status, 200);
    assert.equal(storage.alarm, dueAt);
    await server.onAlarm();
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(apiBody.model, BOT_CHAT_MODEL);
  assert.equal(gameRequests[0].type, "bot.chatContext");
  assert.deepEqual(gameRequests[1], {
    type: "bot.chatResult", botUserId: "bot", jobId: "opaque-job", revision: 1, text: "yo",
  });
  assert.equal(await storage.get("job"), undefined);
  assert.equal(storage.alarm, null);
});

test("isolated bot-chat room skips the model when game validation rejects a job", async () => {
  const storage = createStorage();
  let modelCalled = false;
  const room = {
    id: "game-2", storage, env: { OPENAI_API_KEY: "secret", PARTYKIT_HOST: "localhost:1999" },
    context: { get parties() { throw new Error("alarms must not access cross-party stubs"); } },
  };
  const server = new BotChatServer(room);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://api.openai.com/v1/responses") modelCalled = true;
    assert.equal(String(url), "http://localhost:1999/parties/game/game-2");
    return new Response("stale", { status: 409 });
  };
  try {
    await server.onRequest(new Request("https://bot-chat.test", {
      method: "POST",
      body: JSON.stringify({ type: "bot.chatSchedule", gameId: "game-2", botUserId: "bot", jobId: "stale-job", revision: 1, dueAt: Date.now() - 1 }),
    }));
    await server.onAlarm();
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(modelCalled, false);
  assert.equal(await storage.get("job"), undefined);
});
