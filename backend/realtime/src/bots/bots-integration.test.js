import assert from "node:assert/strict";
import test from "node:test";
import { createSatClassicGame } from "../games/sat-classic.ts";
import { createTimberGame } from "../games/timber.ts";
import { createPunctureGame } from "../games/puncture.ts";
import { createFlutterGame } from "../games/flutter.ts";
import { createBotIdentity } from "./profile.ts";
import { dropNextBotGameAction, ensureBotActions, initializeBots, nextBotDeadline, runNextBotAction } from "./controller.ts";

const questions = Array.from({ length: 10 }, (_, index) => ({
  id: `q${index}`, difficulty: "Easy", module: "english", questionType: "mcq",
  prompt: "Which answer is correct?", paragraph: null,
  choices: ["A", "B", "C", "D"].map((id) => ({ id, label: id })), correctAnswer: "A", acceptableAnswers: [],
}));

const engines = {
  "sat-classic": createSatClassicGame,
  "sat-timber": createTimberGame,
  "sat-puncture": createPunctureGame,
  "sat-flutter": createFlutterGame,
};

for (const [modeId, factory] of Object.entries(engines)) {
  test(`${modeId} accepts scheduled bot actions through the authoritative engine`, () => {
    const human = { userId: "human", displayName: "Human", profilePicture: null, elo: 600, state: {} };
    const bot = { ...createBotIdentity(human, modeId, `${modeId}-seed`), userId: "bot", state: {} };
    const game = {
      gameId: `${modeId}-game`, modeId, ranked: true, status: "active", players: [human, bot],
      state: {}, privateState: {}, events: [], chat: [], startedAt: 0, updatedAt: 0,
    };
    const engine = factory();
    const context = (now) => ({
      now,
      nowCompensated: now,
      addEvent: (type, data = {}, actorUserId = null) => {
        game.eventSequence = (Number(game.eventSequence) || 0) + 1;
        game.events.push({ type, data, actorUserId, createdAt: now, sequence: game.eventSequence });
      },
    });
    engine.initialize(game, questions, context(0));
    initializeBots(game);
    ensureBotActions(game, 0);
    let botActions = 0;
    for (let steps = 0; steps < 4_000 && game.status === "active"; steps += 1) {
      const gameAt = engine.nextDeadline(game);
      const botAt = nextBotDeadline(game);
      const at = [gameAt, botAt].filter((value) => value != null).sort((a, b) => a - b)[0];
      assert.ok(Number.isFinite(at), "active game must retain a deadline");
      if (gameAt != null && gameAt <= (botAt ?? Infinity)) engine.handleDeadline(game, context(gameAt));
      else {
        assert.equal(runNextBotAction(game, engine, context(botAt)), true);
        botActions += 1;
      }
      ensureBotActions(game, at);
    }
    assert.ok(botActions > 0);
    assert.equal(game.status, "finished");
    const learned = game.privateState.botRuntimes.bot.humanProfile;
    assert.ok(learned.questions.answers > 0);
    if (modeId !== "sat-classic") assert.ok(learned.minigame.roundsCompleted > 0);
  });
}

// Mirrors GameServer.runAlarm's rules: a tick that arrives late must DROP stale bot actions
// rather than replay them. Replaying is what let a 30s stall hand the bot ~49 of the 50 chops
// needed to win Timber in a single tick.
test("a long stall drops stale bot actions instead of fast-forwarding the round", () => {
  const STALE_BOT_ACTION_MS = 250;
  const MAX_BOT_ACTIONS_PER_TICK = 4;

  const human = { userId: "human", displayName: "Human", profilePicture: null, elo: 600, state: {} };
  const bot = { ...createBotIdentity(human, "sat-timber", "stall-seed"), userId: "bot", state: {} };
  const game = {
    gameId: "stall-game", modeId: "sat-timber", ranked: true, status: "active", players: [human, bot],
    state: {}, privateState: {}, events: [], chat: [], startedAt: 0, updatedAt: 0,
  };
  const engine = createTimberGame();
  const context = (now) => ({ now, nowCompensated: now, addEvent: () => {} });
  engine.initialize(game, questions, context(0));
  initializeBots(game);

  // Drive into an active chopping round.
  let clock = 0;
  while (game.state.phase !== "timber_active" && clock < 400_000) {
    clock = Number(engine.nextDeadline(game));
    engine.handleDeadline(game, context(clock));
  }
  assert.equal(game.state.phase, "timber_active");
  ensureBotActions(game, clock);

  const chopsBefore = Number(game.players[1].state.timberActualChops) || 0;

  // One tick arrives 32 seconds late - roughly 49 planned chops' worth of backlog.
  const simNow = clock + 32_000;
  let executed = 0;
  let dropped = 0;
  for (let guard = 0; guard < 32; guard += 1) {
    const botDeadline = nextBotDeadline(game);
    if (botDeadline == null || botDeadline > simNow) break;
    if (botDeadline < simNow - STALE_BOT_ACTION_MS && dropNextBotGameAction(game, simNow)) {
      dropped += 1;
      continue;
    }
    if (executed >= MAX_BOT_ACTIONS_PER_TICK) break;
    if (!runNextBotAction(game, engine, context(botDeadline), simNow)) break;
    executed += 1;
  }

  const gained = (Number(game.players[1].state.timberActualChops) || 0) - chopsBefore;
  assert.ok(dropped > 0, "a 32s stall must produce at least one dropped stale action");
  assert.ok(executed <= MAX_BOT_ACTIONS_PER_TICK, `executed ${executed} actions, expected <= ${MAX_BOT_ACTIONS_PER_TICK}`);
  assert.ok(gained <= MAX_BOT_ACTIONS_PER_TICK, `bot gained ${gained} chops in one tick, expected <= ${MAX_BOT_ACTIONS_PER_TICK}`);
  assert.ok(Number(game.players[1].state.timberProgress) < 50, "a single late tick must not be able to win the round");

  // And the bot must be re-planned into the future, not left with a due-now backlog.
  const nextAt = nextBotDeadline(game);
  assert.ok(nextAt != null && nextAt > simNow, "next bot action must be scheduled after the stall, not before it");
});
