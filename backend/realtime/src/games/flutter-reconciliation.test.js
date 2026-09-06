import assert from "node:assert/strict";
import test from "node:test";
import { createFlutterGame, FLUTTER_AVATAR_RADIUS, FLUTTER_RING_INNER_RADIUS } from "./flutter.ts";
import { extrapolateFlutterState } from "../../../../frontend/src/features/multiplayer/games/flutter/flutterPrediction.js";

// Drives the authoritative engine through a flight and checks what a client could have known at
// the moment a ring is actually judged. The scene used to reconcile toward the raw published
// flutterX/flutterY; it now reconciles toward that state carried forward to the present with
// extrapolateFlutterState. These tests pin down what that is worth, because the gap between the
// two is exactly the error that was making cleanly-flown rings register as misses.

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

const RING_TOLERANCE = FLUTTER_RING_INNER_RADIUS - FLUTTER_AVATAR_RADIUS;
const RIGHT = { up: false, down: false, left: false, right: true };
const UP_RIGHT = { up: true, down: false, left: false, right: true };

/** One player's slice of the client's view, as it arrives over the wire (see buildGameView). */
const published = (game, userId) => {
  const state = game.players.find((player) => player.userId === userId).state;
  return {
    x: Number(state.flutterX) || 0,
    y: Number(state.flutterY) || 0,
    velocityX: Number(state.flutterVelocityX) || 0,
    velocityY: Number(state.flutterVelocityY) || 0,
    input: state.flutterInput,
    lastUpdatedAt: Number(state.flutterLastUpdatedAt),
    sequence: Number(state.flutterInputSequence),
  };
};

const setup = () => {
  let now = 1_000;
  const context = (nowCompensated = now) => ({ now, nowCompensated, addEvent: () => {} });
  const game = {
    gameId: "flutter-reconciliation", modeId: "sat-flutter", ranked: true, status: "active",
    players: [
      { userId: "p1", displayName: "One", profilePicture: null, state: {} },
      { userId: "p2", displayName: "Two", profilePicture: null, state: {} },
    ],
    state: {}, privateState: {}, events: [], chat: [], startedAt: 1_000, updatedAt: 1_000,
  };
  const engine = createFlutterGame();
  engine.initialize(game, questions, context());
  const fixture = { game, engine, context, setNow: (value) => { now = value; } };

  fixture.setNow(4_000);
  engine.handleAction(game, "p1", { id: "a1", type: "game.answer", payload: { submittedResponse: "B" } }, context());
  fixture.setNow(4_001);
  engine.handleAction(game, "p2", { id: "a2", type: "game.answer", payload: { submittedResponse: "B" } }, context());
  fixture.setNow(Number(game.state.phaseDeadlineAt));
  engine.handleDeadline(game, context());
  assert.equal(game.state.phase, "flutter_active");

  fixture.roundStartedAt = Number(game.state.flutterRoundStartedAt);
  // The moment the engine will judge the first ring - the only instant in a flight where the
  // server's opinion of a position becomes visible to the player, as a hit or a miss.
  fixture.ringPassAt = Number(game.state.flutterCurrentRingPassAt);
  return fixture;
};

/** Delivers an input the way the transport does: sent at `sentAt`, processed one hop later, with
 * the engine compensating it back to the send time (see GameServer.onMessage's nowCompensated). */
const sendInput = (fixture, userId, sequence, input, sentAt, oneWayMs) => {
  fixture.setNow(sentAt + oneWayMs);
  fixture.engine.handleAction(fixture.game, userId, {
    id: `${userId}-${sequence}`, type: "game.flutterInput", payload: { sequence, ...input },
  }, fixture.context(sentAt));
  return { sequence, at: sentAt, input };
};

/** The engine now scores a ring RING_RESOLVE_GRACE_MS after its plane, so late inputs still count,
 * but it still computes the scored positions at the plane itself - which is why every assertion
 * below compares against extrapolation to `ringPassAt`, not to the deadline. */
const judgeRing = (fixture) => {
  fixture.setNow(Number(fixture.game.state.phaseDeadlineAt));
  fixture.engine.handleDeadline(fixture.game, fixture.context());
  return published(fixture.game, "p2");
};

test("a held direction leaves the published position frozen while the server keeps flying the avatar", () => {
  const fixture = setup();
  sendInput(fixture, "p2", 1, RIGHT, fixture.roundStartedAt + 50, 75);

  // p2 holds right and sends nothing else. The engine only rewrites flutterX when it processes an
  // input or resolves a ring, so nothing further reaches the client for the rest of the flight.
  const wire = published(fixture.game, "p2");
  assert.equal(wire.x, 0, "the published position is still the round-start origin");

  const truth = judgeRing(fixture);
  assert.ok(truth.x > 4, `the server has actually flown p2 out to x=${truth.x}`);

  // What the scene now reconciles toward, from exactly the wire data the old one already had.
  const extrapolated = extrapolateFlutterState(wire, wire.lastUpdatedAt, fixture.ringPassAt);
  assert.ok(Math.abs(extrapolated.x - truth.x) < 1e-9, `extrapolated x=${extrapolated.x} vs truth x=${truth.x}`);
  assert.ok(Math.abs(extrapolated.y - truth.y) < 1e-9, `extrapolated y=${extrapolated.y} vs truth y=${truth.y}`);
});

test("the stale-target error dwarfs the ring tolerance, the extrapolated one is nil", () => {
  const fixture = setup();
  const oneWayMs = 75;
  sendInput(fixture, "p2", 1, RIGHT, fixture.roundStartedAt + 50, oneWayMs);
  sendInput(fixture, "p2", 2, UP_RIGHT, fixture.roundStartedAt + 1_200, oneWayMs);

  const wire = published(fixture.game, "p2");
  const truth = judgeRing(fixture);

  const staleError = Math.hypot(wire.x - truth.x, wire.y - truth.y);
  const extrapolated = extrapolateFlutterState(wire, wire.lastUpdatedAt, fixture.ringPassAt);
  const extrapolatedError = Math.hypot(extrapolated.x - truth.x, extrapolated.y - truth.y);

  assert.ok(
    staleError > RING_TOLERANCE,
    `a ${fixture.ringPassAt - wire.lastUpdatedAt}ms-old target is ${staleError.toFixed(2)} units off, against a ring tolerance of ${RING_TOLERANCE}`,
  );
  assert.ok(extrapolatedError < 1e-9, `extrapolated error ${extrapolatedError} should be nil`);
});

test("replaying an unacknowledged input matches where the engine puts it once that input lands", () => {
  const fixture = setup();
  const oneWayMs = 90;
  sendInput(fixture, "p2", 1, RIGHT, fixture.roundStartedAt + 50, oneWayMs);

  // The client's view the instant before its second input has reached the server: the wire still
  // describes input 1, and input 2 is in flight.
  const wire = published(fixture.game, "p2");
  const pending = { sequence: 2, at: fixture.roundStartedAt + 900, input: UP_RIGHT };
  assert.ok(pending.sequence > wire.sequence, "the replayed input is genuinely unacknowledged");
  const predicted = extrapolateFlutterState(wire, wire.lastUpdatedAt, fixture.ringPassAt, [pending]);

  sendInput(fixture, "p2", pending.sequence, pending.input, pending.at, oneWayMs);
  const truth = judgeRing(fixture);

  assert.ok(Math.abs(predicted.x - truth.x) < 1e-9, `predicted x=${predicted.x} vs truth x=${truth.x}`);
  assert.ok(Math.abs(predicted.y - truth.y) < 1e-9, `predicted y=${predicted.y} vs truth y=${truth.y}`);
});

test("replaying an already-acknowledged input is a no-op, so a late prune cannot corrupt the view", () => {
  const fixture = setup();
  const oneWayMs = 75;
  const acknowledged = sendInput(fixture, "p2", 1, UP_RIGHT, fixture.roundStartedAt + 50, oneWayMs);

  const wire = published(fixture.game, "p2");
  const truth = judgeRing(fixture);
  const pruned = extrapolateFlutterState(wire, wire.lastUpdatedAt, fixture.ringPassAt);
  assert.ok(Math.hypot(pruned.x - truth.x, pruned.y - truth.y) < 1e-9);

  // FlutterGame prunes acknowledged entries on every snapshot, but that prune is a React render
  // behind the frame loop, so the scene will replay an acknowledged entry at least once. That is
  // safe by construction: the anchor's timestamp IS the compensated send time of the last
  // acknowledged input, so such an entry can never advance the integration cursor - it only
  // re-selects an input the anchor already carries. Pruning is housekeeping, not a correctness
  // cliff, and this is the assertion that keeps it that way.
  assert.ok(acknowledged.sequence <= wire.sequence, "this entry is acknowledged");
  assert.ok(acknowledged.at <= wire.lastUpdatedAt, "so it cannot sit ahead of the anchor");
  const replayed = extrapolateFlutterState(wire, wire.lastUpdatedAt, fixture.ringPassAt, [acknowledged]);
  assert.deepEqual({ x: replayed.x, y: replayed.y }, { x: pruned.x, y: pruned.y });
});

/**
 * Replays the scene's actual frame loop headlessly: a 60fps client, inputs reaching the engine one
 * hop late, snapshots coming back one hop after that, and the drawn position produced exactly as
 * FlightAvatar produces it. Then asks the only question that matters - at the instant the engine
 * judges the ring, how far was the avatar the player was looking at from the one the engine
 * scored? Runs the old strategy alongside the new one on identical inputs.
 */
const simulateFlight = ({ oneWayMs, correctionRate, inputScript, useExtrapolation }) => {
  const fixture = setup();
  const frameMs = 1000 / 60;
  const inbox = [];
  const pending = [];
  const scheduled = inputScript.map((entry, index) => ({ ...entry, sequence: index + 1, arrivesAt: entry.at + oneWayMs }));
  let queued = 0;
  let delivered = 0;
  let wire = published(fixture.game, "p2");
  const drawn = { x: wire.x, y: wire.y };
  const offset = { x: 0, y: 0 };
  let lastAnchor = null;

  for (let t = fixture.roundStartedAt; t < fixture.ringPassAt; t += frameMs) {
    while (queued < scheduled.length && scheduled[queued].at <= t) {
      pending.push(scheduled[queued]);
      queued += 1;
    }
    while (delivered < scheduled.length && scheduled[delivered].arrivesAt <= t) {
      const entry = scheduled[delivered];
      delivered += 1;
      fixture.setNow(entry.arrivesAt);
      fixture.engine.handleAction(fixture.game, "p2", {
        id: `i${entry.sequence}`, type: "game.flutterInput", payload: { sequence: entry.sequence, ...entry.input },
      }, fixture.context(entry.at));
      inbox.push({ deliverAt: entry.arrivesAt + oneWayMs, snapshot: published(fixture.game, "p2") });
    }
    while (inbox.length && inbox[0].deliverAt <= t) {
      wire = inbox.shift().snapshot;
      while (pending.length && pending[0].sequence <= wire.sequence) pending.shift();
    }

    const target = useExtrapolation
      ? extrapolateFlutterState(wire, wire.lastUpdatedAt, t, pending)
      : { x: wire.x, y: wire.y };
    if (useExtrapolation) {
      if (wire.lastUpdatedAt !== lastAnchor) {
        lastAnchor = wire.lastUpdatedAt;
        offset.x = drawn.x - target.x;
        offset.y = drawn.y - target.y;
        if (Math.hypot(offset.x, offset.y) > 2.5) { offset.x = 0; offset.y = 0; }
      }
      const decay = Math.exp(-correctionRate * (frameMs / 1000));
      offset.x *= decay;
      offset.y *= decay;
      drawn.x = target.x + offset.x;
      drawn.y = target.y + offset.y;
    } else {
      // The previous strategy: lerp toward the raw published position every frame.
      const blend = 1 - Math.exp(-correctionRate * (frameMs / 1000));
      drawn.x += (target.x - drawn.x) * blend;
      drawn.y += (target.y - drawn.y) * blend;
    }
  }

  const truth = judgeRing(fixture);
  return Math.hypot(drawn.x - truth.x, drawn.y - truth.y);
};

test("the drawn avatar lands where the engine judges it, for both the local player and the opponent", () => {
  // A player working the stick: a direction, a diagonal, a release, a reversal.
  const inputScript = (start) => [
    { at: start + 40, input: { up: false, down: false, left: false, right: true } },
    { at: start + 520, input: UP_RIGHT },
    { at: start + 1_150, input: { up: true, down: false, left: false, right: false } },
    { at: start + 1_800, input: { up: false, down: false, left: true, right: false } },
  ];
  const roundStartedAt = setup().roundStartedAt;

  for (const oneWayMs of [40, 75, 150]) {
    const script = inputScript(roundStartedAt);
    const local = simulateFlight({ oneWayMs, correctionRate: 18, inputScript: script, useExtrapolation: true });
    const opponent = simulateFlight({ oneWayMs, correctionRate: 7, inputScript: script, useExtrapolation: true });
    const previous = simulateFlight({ oneWayMs, correctionRate: 2.2, inputScript: script, useExtrapolation: false });

    assert.ok(local < 0.05, `local drawn-vs-judged error ${local.toFixed(3)} at ${oneWayMs}ms one-way`);
    assert.ok(opponent < RING_TOLERANCE / 4, `opponent drawn-vs-judged error ${opponent.toFixed(3)} at ${oneWayMs}ms one-way`);
    assert.ok(previous > local * 10, `the old strategy was ${previous.toFixed(3)} off, the new one ${local.toFixed(3)}`);
  }
});

test("an input made before the ring but arriving after it still counts", () => {
  const fixture = setup();
  const oneWayMs = 90;
  // Drifting right, heading out of the ring.
  sendInput(fixture, "p2", 1, RIGHT, fixture.roundStartedAt + 50, oneWayMs);

  // The player sees the ring coming and lets go 30ms before the plane. That input cannot reach the
  // Worker until 60ms after the plane, so without a grace window the ring is scored on the input
  // they had already released.
  const releasedAt = fixture.ringPassAt - 30;
  sendInput(fixture, "p2", 2, { up: false, down: false, left: false, right: false }, releasedAt, oneWayMs);

  const state = fixture.game.players.find((player) => player.userId === "p2").state;
  assert.deepEqual(state.flutterInput, { up: false, down: false, left: false, right: false }, "the release was accepted before the ring resolved");
  assert.ok(Number(state.flutterLastUpdatedAt) <= fixture.ringPassAt, "and did not carry the player past the ring plane");

  // The engine still has not scored the ring - it is inside the grace window.
  assert.equal(fixture.game.state.phase, "flutter_active");
  assert.ok(Number(fixture.game.state.phaseDeadlineAt) > fixture.ringPassAt, "the deadline sits past the plane");
});

test("the grace never moves the position a ring is scored on", () => {
  const withLateInput = (sendLate) => {
    const fixture = setup();
    const oneWayMs = 90;
    sendInput(fixture, "p2", 1, RIGHT, fixture.roundStartedAt + 50, oneWayMs);
    // An input made *after* the plane, landing inside the grace window.
    if (sendLate) sendInput(fixture, "p2", 2, UP_RIGHT, fixture.ringPassAt + 20, oneWayMs);
    fixture.setNow(Number(fixture.game.state.phaseDeadlineAt));
    fixture.engine.handleDeadline(fixture.game, fixture.context());
    return published(fixture.game, "p2");
  };

  // Whatever arrives during the grace, the ring is judged on where the player actually was when
  // they flew through it - the clamp in handleAction is what guarantees this.
  const clean = withLateInput(false);
  const withLate = withLateInput(true);
  assert.equal(withLate.x, clean.x);
  assert.equal(withLate.y, clean.y);
});

test("the client's own view still agrees with the engine at the instant a ring is judged", () => {
  const fixture = setup();
  const oneWayMs = 90;
  sendInput(fixture, "p2", 1, RIGHT, fixture.roundStartedAt + 50, oneWayMs);

  // The client's view, with an input it has made after the plane still sitting in its queue. That
  // entry is timestamped after ringPassAt, so it cannot affect what the client draws at the plane
  // either - both sides freeze the judged position on the same inputs.
  const wire = published(fixture.game, "p2");
  const late = { sequence: 2, at: fixture.ringPassAt + 20, input: UP_RIGHT };
  const drawnAtPlane = extrapolateFlutterState(wire, wire.lastUpdatedAt, fixture.ringPassAt, [late]);

  sendInput(fixture, "p2", late.sequence, late.input, late.at, oneWayMs);
  fixture.setNow(Number(fixture.game.state.phaseDeadlineAt));
  fixture.engine.handleDeadline(fixture.game, fixture.context());
  const truth = published(fixture.game, "p2");

  assert.ok(Math.hypot(drawnAtPlane.x - truth.x, drawnAtPlane.y - truth.y) < 1e-9, "no disagreement at the judged instant");
});
