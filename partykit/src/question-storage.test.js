import assert from "node:assert/strict";
import test from "node:test";
import { decodeQuestionChunks, encodeQuestionChunks } from "./question-storage.ts";
import GameServer from "./servers/game.ts";

test("round trips questions larger than a Durable Object storage value", () => {
  const question = {
    id: "large-question",
    prompt: `<img src="data:image/png;base64,${"a".repeat(270_000)}">`,
    choices: [{ id: "A", label: "A" }],
  };

  const chunks = encodeQuestionChunks(question);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.byteLength < 131_072));
  assert.deepEqual(decodeQuestionChunks(chunks), question);
});

test("keeps an oversized set of match questions out of the main game value", async (context) => {
  const values = new Map();
  const room = {
    id: "game-1",
    env: { BACKEND_API_BASE_URL: "https://backend.test" },
    storage: {
      get: async (key) => structuredClone(values.get(key)),
      put: async (key, value) => { values.set(key, structuredClone(value)); },
      setAlarm: async () => {},
    },
    broadcast: () => {},
  };
  const questions = Array.from({ length: 10 }, (_, index) => ({
    id: `question-${index}`,
    prompt: index === 0 ? "x".repeat(270_000) : "A smaller question",
    questionType: "mcq",
    difficulty: "Medium",
    choices: [{ id: "A", label: "Answer" }],
    correctAnswer: "A",
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ questions });
  context.after(() => { globalThis.fetch = originalFetch; });

  const server = new GameServer(room);
  const response = await server.onRequest(new Request("https://game.test", {
    method: "POST",
    body: JSON.stringify({
      type: "game.initialize",
      modeId: "sat-classic",
      ranked: false,
      players: [
        { userId: "p1", displayName: "One", profilePicture: null },
        { userId: "p2", displayName: "Two", profilePicture: null },
      ],
    }),
  }));

  assert.equal(response.status, 200);
  assert.ok(Buffer.byteLength(JSON.stringify(values.get("game"))) < 131_072);
  assert.ok([...values.entries()]
    .filter(([key]) => key.startsWith("question:"))
    .every(([, value]) => value.byteLength < 131_072));
  assert.equal(values.get("game").privateState.questionsById, undefined);

  const restarted = new GameServer(room);
  await restarted.onStart();
  assert.equal(Object.keys(restarted.game.privateState.questionsById).length, 10);
  assert.equal(restarted.game.privateState.questionsById["question-0"].prompt.length, 270_000);
});
