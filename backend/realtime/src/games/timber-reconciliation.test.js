import assert from "node:assert/strict";
import test from "node:test";
import { createTimberGame, MIN_CHOP_INTERVAL_MS, STUN_MS } from "./timber.ts";
import {
  generateBranchSequence as clientGenerateBranchSequence,
  predictChop,
  VISIBLE_BRANCHES,
} from "../../../../frontend/src/features/multiplayer/games/timber/timberPrediction.js";

// Timber's client predicts a chop the moment it is pressed and reconciles against the server
// afterwards. These tests cover the two things that used to break that reconciliation: a branch
// window shallower than the queue of chops a fast player has in flight, and a rejection the
// server never told the client about, which left the queue permanently one entry out of step.

const questions = Array.from({ length: 10 }, (_, index) => ({
  id: `question-${index}`,
  questionType: "mcq",
  prompt: `Question ${index + 1}`,
  choices: [{ id: "A", label: "Correct" }, { id: "B", label: "Wrong" }],
  correctAnswer: "A",
  correctAnswerDisplay: "A",
  difficulty: "Medium",
  module: "math",
}));

const startRound = () => {
  let now = 1_000;
  const context = (nowCompensated = now) => ({ now, nowCompensated, addEvent: () => {} });
  const game = {
    gameId: "timber-reconciliation", modeId: "sat-timber", ranked: true, status: "active",
    players: [
      { userId: "p1", displayName: "One", profilePicture: null, state: {} },
      { userId: "p2", displayName: "Two", profilePicture: null, state: {} },
    ],
    state: {}, privateState: {}, events: [], chat: [], startedAt: 1_000, updatedAt: 1_000,
  };
  const engine = createTimberGame();
  engine.initialize(game, questions, context());
  const fixture = { game, engine, context, setNow: (value) => { now = value; }, now: () => now };

  fixture.setNow(4_000);
  engine.handleAction(game, "p1", { id: "a1", type: "game.answer", payload: { submittedResponse: "B" } }, context());
  fixture.setNow(4_001);
  engine.handleAction(game, "p2", { id: "a2", type: "game.answer", payload: { submittedResponse: "B" } }, context());
  fixture.setNow(Number(game.state.phaseDeadlineAt));
  engine.handleDeadline(game, context());
  assert.equal(game.state.phase, "timber_active");
  return fixture;
};

/** Chops the way the transport does: pressed at `pressedAt`, arriving one hop later. */
const chop = (fixture, userId, side, pressedAt, oneWayMs, clientActionId = `c${pressedAt}`) => {
  fixture.setNow(pressedAt + oneWayMs);
  return fixture.engine.handleAction(fixture.game, userId, {
    id: clientActionId, type: "game.chop", payload: { clientActionId, side },
  }, fixture.context(pressedAt));
};

const player = (fixture, userId) => fixture.game.players.find((entry) => entry.userId === userId).state;

/**
 * Chops forward until the player's next row actually carries a branch. The sequence always opens
 * with empty rows, and an empty row cannot be hit, so this cannot stun on the way. Returns the
 * index of that branch and a press time safely clear of the rate limit.
 */
const advanceToBranch = (fixture, userId, oneWayMs, startAt) => {
  const sequence = fixture.game.privateState.branchSequence;
  let at = startAt;
  for (let guard = 0; guard < 50; guard += 1) {
    const index = Number(player(fixture, userId).timberActualChops) || 0;
    if (sequence[index] != null) return { index, at, side: sequence[index] };
    chop(fixture, userId, "left", at, oneWayMs, `warm-${index}`);
    at += MIN_CHOP_INTERVAL_MS + 10;
  }
  throw new Error("no branch in the generated sequence");
};

test("the published seed regenerates the sequence the round is actually played on", () => {
  const fixture = startRound();
  const seed = Number(fixture.game.state.timberBranchSeed);
  assert.ok(Number.isFinite(seed), "the round publishes its seed");
  assert.deepEqual(clientGenerateBranchSequence(seed), fixture.game.privateState.branchSequence);
});

test("prediction now reaches past the old six-row window, where it used to read undefined", () => {
  const fixture = startRound();
  const sequence = fixture.game.privateState.branchSequence;
  const window = sequence.slice(0, VISIBLE_BRANCHES);
  const full = clientGenerateBranchSequence(Number(fixture.game.state.timberBranchSeed));

  // A fast player routinely has more chops in flight than that window was deep. Past its end the
  // old prediction read undefined and always answered "miss", so it mispredicted every stun out
  // there; the regenerated sequence answers correctly at any depth.
  const deep = sequence.findIndex((branch, index) => branch != null && index >= VISIBLE_BRANCHES);
  assert.ok(deep > 0, "the sequence has a branch beyond the window");
  assert.equal(predictChop({ branches: window, index: deep, side: sequence[deep] }).hit, false, "the window could not see it");
  assert.equal(predictChop({ branches: full, index: deep, side: sequence[deep] }).hit, true, "the full sequence can");
});

test("a chop is judged at the time it was pressed, not the time it reached the Worker", () => {
  const fixture = startRound();
  const oneWayMs = 80;
  const sequence = fixture.game.privateState.branchSequence;
  const roundStartedAt = Number(fixture.game.state.timberRoundStartedAt);

  // Land a hit, which stuns for STUN_MS from the moment of the press.
  const branch = advanceToBranch(fixture, "p1", oneWayMs, roundStartedAt + 100);
  const hitAt = branch.at;
  chop(fixture, "p1", branch.side, hitAt, oneWayMs);
  assert.equal(Number(player(fixture, "p1").stunnedUntil), hitAt + STUN_MS, "the stun runs from the press, not the arrival");

  // The client sees the stun expire at hitAt + STUN_MS and chops immediately after. Judged on
  // arrival that press would still be inside the stun window and be silently thrown away.
  const nextAt = hitAt + STUN_MS + 1;
  const before = Number(player(fixture, "p1").timberActualChops);
  const result = chop(fixture, "p1", "left", nextAt, oneWayMs);
  assert.equal(Number(player(fixture, "p1").timberActualChops), before + 1, "the chop the client predicted was accepted");
  assert.equal(result.reply.payload.accepted, true);
});

test("the rate limit measures the player's own cadence, not network jitter", () => {
  const fixture = startRound();
  const roundStartedAt = Number(fixture.game.state.timberRoundStartedAt);
  const first = roundStartedAt + 50;
  const second = first + MIN_CHOP_INTERVAL_MS + 10;

  // Two presses comfortably apart for the client, delivered by a jittery link that compresses
  // them to 5ms apart on arrival. Judged on arrival, the second is rejected for a rule the player
  // never broke.
  chop(fixture, "p1", "left", first, 100);
  const result = chop(fixture, "p1", "right", second, 100 - MIN_CHOP_INTERVAL_MS - 5);
  assert.equal(result.reply.payload.accepted, true, "the second chop survives the jitter");
  assert.equal(Number(player(fixture, "p1").timberActualChops), 2);
});

test("a rejected chop is named, so the client removes that entry rather than the wrong one", () => {
  const fixture = startRound();
  const oneWayMs = 60;
  const sequence = fixture.game.privateState.branchSequence;
  const roundStartedAt = Number(fixture.game.state.timberRoundStartedAt);

  const branch = advanceToBranch(fixture, "p1", oneWayMs, roundStartedAt + 100);
  const accepted = chop(fixture, "p1", branch.side, branch.at, oneWayMs, "chop-a");
  assert.equal(accepted.reply.payload.accepted, true);
  assert.equal(accepted.reply.payload.clientActionId, "chop-a");
  assert.equal(accepted.reply.payload.actualChops, branch.index + 1, "the acknowledgement carries the count it produced");

  // A second chop straight after the hit, while the stun is still running.
  const rejected = chop(fixture, "p1", "left", branch.at + 50, oneWayMs, "chop-b");
  assert.equal(rejected.reply.payload.accepted, false);
  assert.equal(rejected.reply.payload.clientActionId, "chop-b", "the client learns exactly which chop died");
  assert.equal(rejected.reply.payload.reason, "stunned");
  assert.equal(rejected.changed, false);
});

/**
 * The failure the ledger exists to prevent, reproduced end to end. The old client trimmed as many
 * entries off the front of its queue as the server's chop count had advanced. One silent rejection
 * therefore consumed the wrong entry and left every later prediction reading the branch sequence
 * one row out - which is what made the falling branches rubberband under fast chopping.
 */
test("a mid-stream rejection knocks the counting scheme out of alignment, and the ledger not at all", () => {
  const fixture = startRound();
  const oneWayMs = 60;
  const sequence = fixture.game.privateState.branchSequence;
  const roundStartedAt = Number(fixture.game.state.timberRoundStartedAt);

  const queue = [];
  let pressedAt = roundStartedAt + 40;
  let rejectedId = null;
  for (let index = 0; index < 8; index += 1) {
    const id = `chop-${index}`;
    // Deliberately fast enough that one press falls inside the rate-limit gate.
    const gap = index === 4 ? MIN_CHOP_INTERVAL_MS - 20 : MIN_CHOP_INTERVAL_MS + 20;
    pressedAt += gap;
    queue.push({ id, side: "left", pressedAt });
    const result = chop(fixture, "p1", "left", pressedAt, oneWayMs, id);
    if (!result.reply.payload.accepted) rejectedId = id;
    // Keep the stun out of it; this test is about the rate-limit rejection alone.
    player(fixture, "p1").stunnedUntil = null;
  }
  assert.ok(rejectedId, "one chop in the stream was rejected");

  const serverChops = Number(player(fixture, "p1").timberActualChops);
  assert.equal(serverChops, queue.length - 1, "the server accepted every chop but the one");

  // The old scheme: trim `serverChops` entries off the front and predict from what is left.
  const countingRemainder = queue.slice(serverChops);
  // The ledger: remove the entry the server actually named.
  const ledgerRemainder = queue.filter((entry) => entry.id !== rejectedId).slice(serverChops);

  assert.equal(ledgerRemainder.length, 0, "the ledger has retired every chop the server resolved");
  assert.equal(countingRemainder.length, 1, "counting leaves a phantom entry behind");
  assert.notEqual(countingRemainder[0].id, undefined);

  // That phantom is what shifts the branch alignment: the next chop is predicted one row late.
  const full = clientGenerateBranchSequence(Number(fixture.game.state.timberBranchSeed));
  const remaining = full.slice(serverChops);
  assert.notEqual(countingRemainder.length, ledgerRemainder.length, "the two schemes disagree on how many chops are outstanding");

  // A one-entry offset means every following chop is predicted against the wrong row. Over the
  // next window the two answers must diverge somewhere - that divergence is the mispredicted stun
  // the player sees as a rubberband.
  const disagrees = Array.from({ length: VISIBLE_BRANCHES }, (_, step) => {
    const side = remaining[ledgerRemainder.length + step] ?? "left";
    return predictChop({ branches: remaining, index: ledgerRemainder.length + step, side }).hit
      !== predictChop({ branches: remaining, index: countingRemainder.length + step, side }).hit;
  });
  assert.ok(disagrees.some(Boolean), "a misaligned queue mispredicts a hit within the visible window");
});
