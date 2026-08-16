import assert from "node:assert/strict";
import test from "node:test";
import { createSatClassicGame } from "../games/sat-classic.ts";
import { createTimberGame } from "../games/timber.ts";
import { createPunctureGame } from "../games/puncture.ts";
import { createFlutterGame } from "../games/flutter.ts";
import { createBotIdentity } from "./profile.ts";
import { ensureBotActions, initializeBots, nextBotDeadline, runNextBotAction } from "./controller.ts";

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
    const context = (now) => ({ now, addEvent: (type, data = {}, actorUserId = null) => game.events.push({ type, data, actorUserId, createdAt: now }) });
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
