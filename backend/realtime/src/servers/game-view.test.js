import assert from "node:assert/strict";
import test from "node:test";
import { buildGameView, diffGameView } from "./game-view.ts";

// Mirrors how the client applies a game.update payload (see realtimeSocketService.jsx): each
// patched top-level key fully replaces the previous value, `null` deletes it.
const applyPatch = (view, patch) => {
  const applyRecord = (base, record) => {
    if (!record) return base;
    const next = { ...base };
    for (const [key, value] of Object.entries(record)) {
      if (value === null) delete next[key];
      else next[key] = value;
    }
    return next;
  };
  return {
    room: applyRecord(view.room, patch?.room),
    players: Object.fromEntries(Object.entries(view.players).map(([userId, state]) => [
      userId,
      applyRecord(state, patch?.players?.[userId]),
    ])),
  };
};

test("unchanged view produces no diff", () => {
  const view = { room: { phase: "a" }, players: { p1: { score: 1 } } };
  assert.equal(diffGameView(view, view), null);
  assert.equal(diffGameView(structuredClone(view), structuredClone(view)), null);
});

test("a changed room key is emitted in full, unrelated keys are not", () => {
  const previous = { room: { phase: "a", requiredPins: 20 }, players: {} };
  const next = { room: { phase: "b", requiredPins: 20 }, players: {} };
  const patch = diffGameView(previous, next);
  assert.deepEqual(patch, { room: { phase: "b" } });
});

test("a nested array/object change is resent whole (shallow diff, not deep)", () => {
  const previous = { room: { pins: [1, 2, 3] }, players: {} };
  const next = { room: { pins: [1, 2, 3, 4] }, players: {} };
  const patch = diffGameView(previous, next);
  assert.deepEqual(patch.room.pins, [1, 2, 3, 4]);
});

test("a removed key is emitted as null so the client can delete it", () => {
  const previous = { room: { questionsById: { q1: {} } }, players: {} };
  const next = { room: {}, players: {} };
  const patch = diffGameView(previous, next);
  assert.deepEqual(patch, { room: { questionsById: null } });
});

test("only the changed player's state is included, not the untouched one", () => {
  const previous = { room: {}, players: { p1: { score: 0 }, p2: { score: 0 } } };
  const next = { room: {}, players: { p1: { score: 1 }, p2: { score: 0 } } };
  const patch = diffGameView(previous, next);
  assert.deepEqual(patch, { players: { p1: { score: 1 } } });
});

test("round-trip property: applying every diff in sequence reproduces the final view exactly", () => {
  const players = ["p1", "p2"];
  let view = { room: { phase: "question_active", questionIndex: 0 }, players: { p1: { score: 0 }, p2: { score: 0 } } };
  let reconstructed = structuredClone(view);

  const randomMutation = (v, seed) => {
    const next = structuredClone(v);
    const pick = seed % 5;
    if (pick === 0) next.room.phase = `phase-${seed}`;
    else if (pick === 1) next.room.questionIndex = seed;
    else if (pick === 2) next.players[players[seed % 2]].score = seed;
    else if (pick === 3) next.players[players[seed % 2]].puncturePinAngles = [seed, seed + 1];
    else if (pick === 4 && seed % 7 === 0) delete next.room.questionIndex; // occasional key removal
    return next;
  };

  for (let seed = 1; seed <= 200; seed += 1) {
    const nextView = randomMutation(view, seed);
    const patch = diffGameView(view, nextView);
    if (patch) reconstructed = applyPatch(reconstructed, patch);
    view = nextView;
  }

  assert.deepEqual(reconstructed, view, "reconstructed view must exactly match the real view after 200 random diffs");
});

test("a view survives later in-place mutation of the same player.state object", () => {
  // This is how every engine actually writes player state - `player.state.pinsRemaining = x`,
  // not `player.state = {...player.state, pinsRemaining: x}` - so buildGameView MUST clone, or a
  // stored view and every later view alias the same object and a diff against it always finds
  // nothing changed, silently dropping every player-state update forever.
  const player = { userId: "p1", state: { pinsRemaining: 20 } };
  const game = {
    gameId: "g1", modeId: "sat-puncture", ranked: true, status: "active",
    players: [player], state: { phase: "puncture_active" }, privateState: {}, events: [], chat: [], startedAt: 0, updatedAt: 0,
  };
  const before = buildGameView(game, null);
  player.state.pinsRemaining = 19; // in-place mutation, same object reference
  const after = buildGameView(game, null);
  assert.equal(before.players.p1.pinsRemaining, 20, "the earlier view must not see the later mutation");
  assert.equal(after.players.p1.pinsRemaining, 19);
  const patch = diffGameView(before, after);
  assert.deepEqual(patch, { players: { p1: { pinsRemaining: 19 } } }, "the mutation must be detected as a real diff");
});

test("buildGameView reads publicState() for room and each player's own state", () => {
  const game = {
    gameId: "g1", modeId: "sat-timber", ranked: true, status: "active",
    players: [{ userId: "p1", state: { score: 3 } }, { userId: "p2", state: { score: 1 } }],
    state: { phase: "timber_active" }, privateState: {}, events: [], chat: [], startedAt: 0, updatedAt: 0,
  };
  const engine = { publicState: (g) => ({ ...g.state, derived: true }) };
  const view = buildGameView(game, engine);
  assert.deepEqual(view.room, { phase: "timber_active", derived: true, status: "active" });
  assert.deepEqual(view.players, { p1: { score: 3 }, p2: { score: 1 } });
});

test("buildGameView falls back to raw state when there is no engine", () => {
  const game = {
    gameId: "g1", modeId: "unknown", ranked: false, status: "active",
    players: [], state: { phase: "x" }, privateState: {}, events: [], chat: [], startedAt: 0, updatedAt: 0,
  };
  assert.deepEqual(buildGameView(game, null).room, { phase: "x", status: "active" });
});
