import assert from "node:assert/strict";
import test from "node:test";
import {
  BOT_CHAT_MODEL,
  MODE_CHAT_CONTEXT,
  answerChatMessage,
  buildBotChatInstructions,
  createBotChatGenerationRequest,
  getBotStanding,
  typingDelayMs,
} from "./chat.ts";
import {
  beginBotChatGeneration,
  completeBotChatGeneration,
  failBotChatGeneration,
  initializeBots,
  runNextBotAction,
  scheduleBotChatReply,
} from "./controller.ts";
import { createBotIdentity } from "./profile.ts";

const humanIdentity = { userId: "human", displayName: "Human", profilePicture: null, elo: 700 };

const makeGame = (modeId = "sat-classic") => {
  const bot = { ...createBotIdentity(humanIdentity, modeId, `chat-${modeId}`), userId: "bot", state: {} };
  const human = { ...humanIdentity, state: {} };
  if (modeId === "sat-classic") {
    bot.state.health = 2_000;
    human.state.health = 1_000;
  } else {
    bot.state.score = 2;
    human.state.score = 1;
  }
  const game = {
    gameId: `chat-${modeId}`, modeId, ranked: true, status: "active",
    players: [human, bot], state: { phase: "chat_only" }, privateState: {}, events: [], chat: [], startedAt: 0, updatedAt: 0,
  };
  initializeBots(game);
  return game;
};

const addHumanMessage = (game, uid, text) => {
  const message = { uid, userId: "human", senderName: "Human", text, createdAt: Number(uid.replace(/\D/g, "")) || 1 };
  game.chat.push(message);
  return message;
};

const finishPendingReply = (game, dispatch, text = "hey", generatedAt = dispatch.dueAt + 10) => {
  const started = beginBotChatGeneration(game, dispatch.botUserId, dispatch.jobId, dispatch.revision, dispatch.dueAt);
  assert.ok(started?.request);
  assert.equal(completeBotChatGeneration(game, dispatch.botUserId, dispatch.jobId, dispatch.revision, text, generatedAt), true);
  const bot = game.privateState.botRuntimes.bot;
  const delivery = bot.scheduled.find((action) => action.kind === "chat_send");
  assert.ok(delivery);
  assert.equal(runNextBotAction(game, { handleAction() {} }, { now: delivery.at, addEvent() {} }), true);
};

test("builds the exact social prompt with only runtime substitutions", () => {
  const instructions = buildBotChatInstructions({
    displayName: "QuickFox12345", modeName: "Timber",
    modeContext: MODE_CHAT_CONTEXT["sat-timber"], standing: "LOSING",
  });
  assert.ok(instructions.startsWith("You are the social brain for a player bot in Studium, an online multiplayer SAT game."));
  assert.ok(instructions.includes("- Name: QuickFox12345\n- Current gamemode: Timber"));
  assert.ok(instructions.includes(`- Gamemode context: ${MODE_CHAT_CONTEXT["sat-timber"]}`));
  assert.ok(instructions.includes("- You are currently LOSING"));
  assert.ok(instructions.endsWith("**Being plain is better than trying too hard.**"));
  assert.equal(instructions.includes("ADD_NAME_HERE_IN_CODE"), false);
});

test("computes standings from Classic health and other mode scores", () => {
  const classic = makeGame("sat-classic");
  assert.equal(getBotStanding(classic, "bot"), "WINNING");
  classic.players[0].state.health = 2_000;
  assert.equal(getBotStanding(classic, "bot"), "TIED");
  classic.players[0].state.health = 2_500;
  assert.equal(getBotStanding(classic, "bot"), "LOSING");
  for (const modeId of ["sat-timber", "sat-puncture", "sat-flutter"]) {
    assert.equal(getBotStanding(makeGame(modeId), "bot"), "WINNING");
  }
});

test("uses all human messages since the bot's previous reply", () => {
  const game = makeGame();
  const runtime = game.privateState.botRuntimes.bot;
  game.chat.push(
    { uid: "old-human", userId: "human", text: "old", senderName: "Human", createdAt: 1 },
    { uid: "bot-reply", userId: "bot", text: "ok", senderName: "Bot", createdAt: 2 },
    { uid: "new-1", userId: "human", text: "what", senderName: "Human", createdAt: 3 },
    { uid: "system", userId: null, text: "notice", senderName: "System", createdAt: 4, system: true },
    { uid: "new-2", userId: "human", text: "respond", senderName: "Human", createdAt: 5 },
  );
  runtime.chat.lastBotMessageUid = "bot-reply";
  assert.deepEqual(createBotChatGenerationRequest(game, runtime).messages, ["what", "respond"]);
});

test("calls pinned GPT-5.4 nano through Responses and sanitizes output", async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: `  ${"x".repeat(350)}  ` }] }] }), { status: 200 });
  };
  const request = { displayName: "Bot", modeName: "Classic", modeContext: MODE_CHAT_CONTEXT["sat-classic"], standing: "TIED", messages: ["yo", "hello"] };
  const result = await answerChatMessage(request, "secret", { fetchImpl });
  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.equal(captured.init.headers.Authorization, "Bearer secret");
  assert.equal(captured.body.model, BOT_CHAT_MODEL);
  assert.deepEqual(captured.body.reasoning, { effort: "none" });
  assert.deepEqual(captured.body.text, { verbosity: "low" });
  assert.equal(captured.body.max_output_tokens, 80);
  assert.equal(captured.body.store, false);
  assert.deepEqual(captured.body.input, [{ role: "user", content: "yo" }, { role: "user", content: "hello" }]);
  assert.equal(result.length, 300);
  assert.equal(await answerChatMessage(request, undefined, { fetchImpl }), null);
  assert.equal(await answerChatMessage(request, "secret", { fetchImpl: async () => new Response("bad", { status: 429 }) }), null);
});

test("silently times out a slow OpenAI request", async () => {
  const request = { displayName: "Bot", modeName: "Classic", modeContext: MODE_CHAT_CONTEXT["sat-classic"], standing: "TIED", messages: ["yo"] };
  const fetchImpl = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  assert.equal(await answerChatMessage(request, "secret", { fetchImpl, timeoutMs: 5 }), null);
});

test("typing delay uses the full 60 WPM formula", () => {
  assert.equal(typingDelayMs("yo"), 1_000);
  assert.equal(typingDelayMs("nothing just playing"), 3_000);
  assert.equal(typingDelayMs("  one   two\nthree four  "), 4_000);
  assert.equal(typingDelayMs(""), 0);
});

test("debounces rapid messages into one restart-safe generation job", () => {
  const game = makeGame();
  const first = scheduleBotChatReply(game, addHumanMessage(game, "m1", "hi"), 1_000);
  assert.equal(first.length, 1);
  assert.equal(first[0].dueAt, 1_750);
  const second = scheduleBotChatReply(game, addHumanMessage(game, "m2", "hello"), 1_400);
  assert.equal(second.length, 1);
  assert.equal(second[0].jobId, first[0].jobId);
  assert.equal(second[0].revision, 2);
  assert.equal(second[0].dueAt, 2_150);
  assert.deepEqual(beginBotChatGeneration(game, "bot", second[0].jobId, second[0].revision, 2_000), { retryAt: 2_150 });
  const started = beginBotChatGeneration(game, "bot", second[0].jobId, second[0].revision, 2_150);
  assert.deepEqual(started.request.messages, ["hi", "hello"]);
  assert.equal(scheduleBotChatReply(game, addHumanMessage(game, "m3", "respond"), 2_200).length, 0);
});

test("sends ten regular replies, then waits 3-6 messages, and stops at twenty", () => {
  const game = makeGame();
  for (let index = 0; index < 10; index += 1) {
    const dispatch = scheduleBotChatReply(game, addHumanMessage(game, `m${index}`, `message ${index}`), index * 10_000)[0];
    assert.ok(dispatch);
    finishPendingReply(game, dispatch);
  }
  const runtime = game.privateState.botRuntimes.bot;
  assert.equal(runtime.chat.sentCount, 10);
  assert.ok(runtime.chat.nextResponseAfter >= 3 && runtime.chat.nextResponseAfter <= 6);
  const threshold = runtime.chat.nextResponseAfter;
  for (let index = 1; index < threshold; index += 1) {
    assert.equal(scheduleBotChatReply(game, addHumanMessage(game, `s${index}`, "wait"), 100_000 + index).length, 0);
  }
  assert.equal(scheduleBotChatReply(game, addHumanMessage(game, "s-final", "now"), 100_100).length, 1);
  failBotChatGeneration(game, "bot", runtime.chat.pending.id, runtime.chat.pending.revision);
  assert.equal(runtime.chat.sentCount, 10, "failed requests do not count as sent replies");
  runtime.chat.sentCount = 20;
  assert.equal(scheduleBotChatReply(game, addHumanMessage(game, "never", "hello?"), 200_000).length, 0);
});

test("schedules full typing time after generation and rejects stale callbacks", () => {
  const game = makeGame();
  const dispatch = scheduleBotChatReply(game, addHumanMessage(game, "m1", "what's up"), 1_000)[0];
  assert.equal(beginBotChatGeneration(game, "bot", dispatch.jobId, dispatch.revision, dispatch.dueAt).request.messages.length, 1);
  assert.equal(completeBotChatGeneration(game, "bot", "wrong-job", dispatch.revision, "nothing just playing", 3_000), false);
  assert.equal(completeBotChatGeneration(game, "bot", dispatch.jobId, dispatch.revision, "nothing just playing", 3_000), true);
  const delivery = game.privateState.botRuntimes.bot.scheduled.find((action) => action.kind === "chat_send");
  assert.equal(delivery.at, 6_000);
});
