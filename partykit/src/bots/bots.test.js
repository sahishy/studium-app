import assert from "node:assert/strict";
import test from "node:test";
import { BOT_AVATAR_COLORS, createBotIdentity, createBotRuntime } from "./profile.ts";
import { satAccuracy, satAnswerDelayMs } from "./sat.ts";
import { flutterMissProbability, planFlutterAction } from "./flutter.ts";
import { getPunctureCrowdingStage, planPunctureAction, punctureWouldHit } from "./puncture.ts";
import { initializeBots, nextBotDeadline, observeHumanAction } from "./controller.ts";

const human = { userId: "human", displayName: "Human", profilePicture: null, elo: 700, eloByMode: { "sat-classic": 700 } };

test("creates a database-free bot profile near the human rating", () => {
  const bot = createBotIdentity(human, "sat-classic", "stable-seed");
  assert.match(bot.displayName, /^[A-Za-z]+[A-Za-z]+\d{5}$/);
  assert.ok(BOT_AVATAR_COLORS.includes(bot.avatar.color));
  assert.ok([0, 1, 2].includes(bot.avatar.face));
  assert.ok(bot.elo >= 0 && bot.elo <= 1600);
  assert.ok(Math.abs(bot.elo - human.elo) < 240);
  assert.equal(bot.profilePicture, null);
  assert.equal(bot.isBot, true);
});

test("SAT timing grows with passage and difficulty while accuracy grows with Elo", () => {
  const identity = { ...createBotIdentity(human, "sat-classic", "sat-seed"), userId: "bot" };
  const easyBot = createBotRuntime(identity, "game-a");
  const hardBot = createBotRuntime(identity, "game-a");
  const easy = { difficulty: "Easy", module: "english", questionType: "mcq", prompt: "Short question", choices: [{ id: "A", label: "One" }] };
  const hard = { ...easy, difficulty: "Hard", paragraph: Array(180).fill("word").join(" ") };
  assert.ok(satAnswerDelayMs(hard, 700, hardBot) > satAnswerDelayMs(easy, 700, easyBot));
  assert.ok(satAccuracy(easy, 1400, easyBot) > satAccuracy(easy, 100, easyBot));
});

test("Flutter mistakes increase through a round and stay bounded", () => {
  const early = flutterMissProbability(800, 0, 0.05);
  const late = flutterMissProbability(800, 20, 0.05);
  assert.ok(late > early);
  assert.ok(late <= 0.35);
});

test("bot runtime is persisted and schedulable", () => {
  const bot = { ...createBotIdentity(human, "sat-classic", "runtime-seed"), userId: "bot" };
  const game = {
    gameId: "game", modeId: "sat-classic", ranked: true, status: "active",
    players: [{ ...human, state: {} }, { ...bot, state: {} }], state: {}, privateState: {}, events: [], chat: [], startedAt: 0, updatedAt: 0,
  };
  initializeBots(game);
  const runtime = game.privateState.botRuntimes.bot;
  runtime.scheduled.push({ id: "one", at: 123, phaseKey: "x", kind: "game" });
  assert.equal(nextBotDeadline(game), 123);
  assert.equal(runtime.chat.sentCount, 0);
  assert.equal(runtime.chat.pending, null);
});

test("a human answer never leaves an immediately due bot answer", () => {
  const botIdentity = { ...createBotIdentity(human, "sat-classic", "pressure-seed"), userId: "bot" };
  const game = {
    gameId: "pressure", modeId: "sat-classic", ranked: true, status: "active",
    players: [{ ...human, state: { answeredQuestionIds: ["q1"] } }, { ...botIdentity, state: { answeredQuestionIds: [] } }],
    state: { phase: "question_active", currentQuestionId: "q1" }, privateState: {}, events: [], chat: [], startedAt: 0, updatedAt: 0,
  };
  initializeBots(game);
  const runtime = game.privateState.botRuntimes.bot;
  runtime.scheduled.push({ id: "due", at: 9_000, phaseKey: "question_active:q1::", kind: "game", message: { id: "answer", type: "game.answer", payload: { submittedResponse: "A" } } });
  observeHumanAction(game, "human", { id: "human-answer", type: "game.answer", payload: { submittedResponse: "B" } }, 10_000, { answeredQuestionIds: [] });
  const pending = runtime.scheduled.find((action) => action.message?.type === "game.answer");
  assert.ok(!pending || pending.at >= 13_000);
  if (!pending) assert.equal(runtime.skippedQuestionId, "q1");
});

test("keeps separate question and minigame performance across Timber rounds", () => {
  const botIdentity = { ...createBotIdentity(human, "sat-timber", "profile-seed"), userId: "bot" };
  const humanPlayer = { ...human, state: { answeredQuestionIds: ["q1"], timberActualChops: 0, stunnedUntil: null } };
  const game = {
    gameId: "profile", modeId: "sat-timber", ranked: true, status: "active",
    players: [humanPlayer, { ...botIdentity, state: {} }],
    state: { phase: "question_active", currentQuestionId: "q1", timberRoundIndex: 0 },
    privateState: { questionsById: { q1: { id: "q1", difficulty: "Medium" } }, answersByUserId: { human: { isCorrect: true, elapsedMs: 8_000 } } },
    events: [], chat: [], startedAt: 0, updatedAt: 0,
  };
  initializeBots(game);
  observeHumanAction(game, "human", { id: "answer", type: "game.answer" }, 8_000, { answeredQuestionIds: [] });
  const profile = game.privateState.botRuntimes.bot.humanProfile;
  assert.equal(profile.questions.answers, 1);
  assert.equal(profile.questions.correct, 1);
  assert.equal(profile.questions.answerMsByDifficulty.Medium, 8_000);
  assert.equal(profile.minigame.actions, 0);

  game.state.phase = "timber_active";
  humanPlayer.state.timberActualChops = 1;
  observeHumanAction(game, "human", { id: "chop-1", type: "game.chop" }, 10_000, { timberActualChops: 0, stunnedUntil: null });
  humanPlayer.state.timberActualChops = 2;
  observeHumanAction(game, "human", { id: "chop-2", type: "game.chop" }, 10_200, { timberActualChops: 1, stunnedUntil: null });
  assert.equal(profile.minigame.intervalEwma, 200);

  game.state.timberRoundIndex = 1;
  humanPlayer.state.timberActualChops = 1;
  observeHumanAction(game, "human", { id: "round-2-chop", type: "game.chop" }, 30_000, { timberActualChops: 0, stunnedUntil: null });
  assert.equal(profile.minigame.intervalEwma, 200, "question/countdown time must not pollute learned chop cadence");
  assert.equal(profile.questions.answers, 1);
});

test("Puncture uses learned speed with varied timing and avoids repeated collisions", () => {
  const identity = { ...createBotIdentity(human, "sat-puncture", "puncture-noise"), userId: "bot" };
  const bot = createBotRuntime(identity, "puncture-noise-game", "human");
  bot.humanProfile.minigame.actions = 2;
  bot.humanProfile.minigame.intervalEwma = 260;
  bot.humanProfile.minigame.accuracyEwma = 0.9;
  const game = {
    modeId: "sat-puncture",
    players: [{ ...identity, isBot: true, state: { puncturePinAngles: [], stunnedUntil: 0, pinsRemaining: 20 } }, { userId: "human", state: { pinsRemaining: 20 } }],
    state: { punctureRoundStartedAt: 0, rotationTurnsPerSecond: 0.35, generatedPinAngles: [0, 90, 180, 270] },
    privateState: {}, events: [], chat: [],
  };
  let now = 1_000;
  let collisions = 0;
  const intervals = [];
  for (let index = 0; index < 24; index += 1) {
    const action = planPunctureAction(game, bot, now);
    intervals.push(Math.round(action.at - now));
    collisions += Number(punctureWouldHit(game, "bot", action.at));
    now = action.at;
  }
  assert.ok(new Set(intervals).size > 12, "shot spacing should contain human timing noise");
  assert.ok(collisions < 8, "the bot should not collide on most releases");
});

test("Puncture spams an open board and slows down as safe windows shrink", () => {
  assert.equal(getPunctureCrowdingStage(6), "open");
  assert.equal(getPunctureCrowdingStage(12), "crowded");
  assert.equal(getPunctureCrowdingStage(19), "precision");
  const identity = { ...createBotIdentity(human, "sat-puncture", "density-pace"), userId: "bot" };
  const makeGame = (attached) => ({
    modeId: "sat-puncture",
    players: [{ ...identity, isBot: true, state: { puncturePinAngles: attached, stunnedUntil: 0, pinsRemaining: 20 } }, { userId: "human", state: { pinsRemaining: 20 } }],
    state: { punctureRoundStartedAt: 0, rotationTurnsPerSecond: 0.35, generatedPinAngles: [0, 90, 180, 270] },
    privateState: {}, events: [], chat: [],
  });
  const sampleAverage = (attached, id) => {
    const game = makeGame(attached);
    const bot = createBotRuntime(identity, id, "human");
    let now = 1_000;
    const intervals = [];
    for (let index = 0; index < 18; index += 1) {
      const action = planPunctureAction(game, bot, now);
      intervals.push(action.at - now);
      now = action.at;
    }
    return intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  };
  const openAverage = sampleAverage([], "open-density");
  const precisionAverage = sampleAverage([18, 36, 54, 72, 108, 126, 144, 162, 198, 216, 234, 252, 288], "precision-density");
  assert.ok(openAverage >= 200 && openAverage < 500, `open-board cadence should be a controlled volley; got ${openAverage}ms`);
  assert.ok(precisionAverage > openAverage * 1.7, `crowded shots should be meaningfully slower (${openAverage}ms vs ${precisionAverage}ms)`);
});

test("Puncture quickly adapts its open-board volley to a slower human", () => {
  const identity = { ...createBotIdentity(human, "sat-puncture", "open-adaptation"), userId: "bot" };
  const makeBot = (id, learnedInterval = null) => {
    const bot = createBotRuntime(identity, id, "human");
    if (learnedInterval != null) {
      bot.humanProfile.minigame.actions = 3;
      bot.humanProfile.minigame.intervalEwma = learnedInterval;
      bot.humanProfile.minigame.puncture.actionsByStage.open = 3;
      bot.humanProfile.minigame.puncture.intervalMsByStage.open = learnedInterval;
    }
    return bot;
  };
  const game = {
    modeId: "sat-puncture",
    players: [{ ...identity, isBot: true, state: { puncturePinAngles: [], stunnedUntil: 0, pinsRemaining: 20 } }, { userId: "human", state: { pinsRemaining: 20 } }],
    state: { punctureRoundStartedAt: 0, rotationTurnsPerSecond: 0.35, generatedPinAngles: [0, 90, 180, 270] },
    privateState: {}, events: [], chat: [],
  };
  const averageFor = (bot) => {
    let now = 1_000;
    let total = 0;
    for (let index = 0; index < 24; index += 1) {
      const action = planPunctureAction(game, bot, now);
      total += action.at - now;
      now = action.at;
    }
    return total / 24;
  };
  const defaultAverage = averageFor(makeBot("default-open"));
  const adaptedAverage = averageFor(makeBot("learned-open", 500));
  assert.ok(adaptedAverage > defaultAverage * 1.35, `learned cadence should noticeably slow the volley (${defaultAverage}ms vs ${adaptedAverage}ms)`);
});

test("Puncture learns separate human cadences for open and crowded boards", () => {
  const botIdentity = { ...createBotIdentity(human, "sat-puncture", "stage-learning"), userId: "bot" };
  const humanPlayer = { ...human, state: { punctureShotCount: 0, puncturePinAngles: [], lastShotHit: false } };
  const game = {
    gameId: "stage-learning", modeId: "sat-puncture", ranked: true, status: "active",
    players: [humanPlayer, { ...botIdentity, state: {} }],
    state: { phase: "puncture_active", punctureRoundIndex: 0, generatedPinAngles: [0, 90, 180, 270] },
    privateState: {}, events: [], chat: [], startedAt: 0, updatedAt: 0,
  };
  initializeBots(game);
  const shoot = (at, beforeAngles) => {
    const beforeCount = humanPlayer.state.punctureShotCount;
    humanPlayer.state.punctureShotCount += 1;
    humanPlayer.state.puncturePinAngles = [...beforeAngles, at];
    observeHumanAction(game, "human", { id: `shot-${at}`, type: "game.shoot" }, at, {
      punctureShotCount: beforeCount, puncturePinAngles: beforeAngles,
    });
  };
  shoot(1_000, []);
  shoot(1_180, [10]);
  shoot(1_360, [10, 20]);
  shoot(2_000, [10, 20, 30, 40, 50, 60, 70, 80, 100, 110, 120, 130, 140]);
  shoot(2_720, [10, 20, 30, 40, 50, 60, 70, 80, 100, 110, 120, 130, 140, 150]);
  const learned = game.privateState.botRuntimes.bot.humanProfile.minigame.puncture;
  assert.equal(learned.intervalMsByStage.open, 180);
  assert.ok(learned.intervalMsByStage.precision > 650);
  assert.ok(learned.intervalMsByStage.precision > learned.intervalMsByStage.open * 3);
});

test("Flutter stays still when aligned and releases movement after a short pulse", () => {
  const identity = { ...createBotIdentity(human, "sat-flutter", "flutter-pulse"), userId: "bot" };
  const bot = createBotRuntime(identity, "flutter-pulse-game", "human");
  const player = {
    ...identity, isBot: true,
    state: { flutterX: 0, flutterY: 0, flutterVelocityX: 0, flutterVelocityY: 0, flutterInput: { up: false, down: false, left: false, right: false } },
  };
  const game = {
    modeId: "sat-flutter", players: [player, { userId: "human", state: {} }],
    state: { flutterRingIndex: 0, flutterSeed: 42, flutterCurrentRingPassAt: 3_000 }, privateState: {}, events: [], chat: [],
  };
  const aligned = planFlutterAction(game, bot, 1_000);
  assert.deepEqual({ ...aligned.payload, sequence: 0 }, { sequence: 0, left: false, right: false, down: false, up: false });

  player.state.flutterInput = { up: true, down: false, left: false, right: true };
  const release = planFlutterAction(game, bot, 1_100);
  assert.equal(release.payload.up, false);
  assert.equal(release.payload.right, false);
  assert.ok(release.at - 1_100 >= 110 && release.at - 1_100 <= 260);
});
