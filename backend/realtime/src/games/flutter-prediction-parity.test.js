import assert from "node:assert/strict";
import test from "node:test";
import {
  FLUTTER_AVATAR_RADIUS as SERVER_AVATAR_RADIUS,
  FLUTTER_BOUNDS as SERVER_BOUNDS,
  FLUTTER_MAX_SPEED as SERVER_MAX_SPEED,
  FLUTTER_RING_INNER_RADIUS as SERVER_RING_INNER_RADIUS,
  integrateFlutterMotion as serverIntegrate,
} from "./flutter.ts";
import {
  clearsFlutterRing,
  extrapolateFlutterState,
  FLUTTER_AVATAR_RADIUS as CLIENT_AVATAR_RADIUS,
  FLUTTER_BOUNDS as CLIENT_BOUNDS,
  FLUTTER_MAX_SPEED as CLIENT_MAX_SPEED,
  FLUTTER_RING_INNER_RADIUS as CLIENT_RING_INNER_RADIUS,
  integrateFlutterMotion as clientIntegrate,
} from "../../../../frontend/src/features/multiplayer/games/flutter/flutterPrediction.js";

// The client reproduces the server's flight integration locally so it can show where the server
// believes each avatar is right now, rather than lerping toward a position the server published
// one round trip ago (frontend/.../flutter/flutterPrediction.js). This test is what keeps that
// duplicated integrator honest against the authoritative engine.

const INPUTS = [
  { up: false, down: false, left: false, right: false },
  { up: true, down: false, left: false, right: false },
  { up: false, down: true, left: false, right: false },
  { up: false, down: false, left: true, right: false },
  { up: false, down: false, left: false, right: true },
  { up: true, down: false, left: false, right: true },
  { up: false, down: true, left: true, right: false },
  { up: true, down: true, left: true, right: true },
];

test("prediction constants match the server exactly", () => {
  assert.equal(CLIENT_MAX_SPEED, SERVER_MAX_SPEED);
  assert.equal(CLIENT_AVATAR_RADIUS, SERVER_AVATAR_RADIUS);
  assert.equal(CLIENT_RING_INNER_RADIUS, SERVER_RING_INNER_RADIUS);
  assert.deepEqual({ ...CLIENT_BOUNDS }, { ...SERVER_BOUNDS });
});

test("integrateFlutterMotion agrees with the engine across inputs, durations and start states", () => {
  const starts = [
    { x: 0, y: 0, velocityX: 0, velocityY: 0 },
    { x: 1.4, y: -0.8, velocityX: 3.1, velocityY: -2.2 },
    { x: -5.19, y: 3.14, velocityX: -6.4, velocityY: 6.4 },
    { x: 5.2, y: -3.15, velocityX: 6.4, velocityY: -6.4 },
  ];
  for (const start of starts) {
    for (const input of INPUTS) {
      for (const elapsedMs of [0, 1, 8, 16.6667, 33, 100, 250, 1_000, 2_600]) {
        const expected = serverIntegrate({ ...start, input }, elapsedMs);
        const actual = clientIntegrate({ ...start, input }, elapsedMs);
        assert.deepEqual(actual, expected, `input=${JSON.stringify(input)} elapsed=${elapsedMs} start=${JSON.stringify(start)}`);
      }
    }
  }
});

test("integrateFlutterMotion zeroes velocity against a bound, on both sides", () => {
  const pinned = clientIntegrate({ x: 0, y: 0, velocityX: 0, velocityY: 0, input: { up: false, down: false, left: false, right: true } }, 5_000);
  assert.equal(pinned.x, SERVER_BOUNDS.x);
  assert.equal(pinned.velocityX, 0);
  assert.deepEqual(pinned, serverIntegrate({ x: 0, y: 0, velocityX: 0, velocityY: 0, input: { up: false, down: false, left: false, right: true } }, 5_000));
});

test("extrapolateFlutterState with no pending input equals a single integration over the gap", () => {
  const anchor = { x: -1.2, y: 0.6, velocityX: 2.4, velocityY: -1.1, input: INPUTS[5] };
  for (const gapMs of [0, 17, 120, 400, 3_000]) {
    const expected = serverIntegrate(anchor, gapMs);
    const actual = extrapolateFlutterState(anchor, 1_000_000, 1_000_000 + gapMs);
    assert.deepEqual({ x: actual.x, y: actual.y, velocityX: actual.velocityX, velocityY: actual.velocityY }, expected, `gap=${gapMs}`);
  }
});

test("extrapolateFlutterState replays pending inputs exactly where the engine would apply them", () => {
  // The engine applies an input by integrating up to its (latency-compensated) timestamp and only
  // then swapping the input in - see handleAction's integratePlayerTo(player, nowCompensated).
  const from = 500_000;
  const anchor = { x: 0, y: 0, velocityX: 0, velocityY: 0, input: INPUTS[0] };
  const pending = [
    { at: from + 60, input: INPUTS[4] },
    { at: from + 210, input: INPUTS[5] },
    { at: from + 275, input: INPUTS[0] },
  ];
  const to = from + 400;

  let expected = { ...anchor };
  let cursor = from;
  for (const entry of pending) {
    expected = { ...serverIntegrate(expected, entry.at - cursor), input: entry.input };
    cursor = entry.at;
  }
  expected = serverIntegrate(expected, to - cursor);

  const actual = extrapolateFlutterState(anchor, from, to, pending);
  assert.deepEqual({ x: actual.x, y: actual.y, velocityX: actual.velocityX, velocityY: actual.velocityY }, expected);
});

test("extrapolateFlutterState ignores a target behind the anchor instead of producing NaN", () => {
  const anchor = { x: 2, y: -1, velocityX: 1, velocityY: 1, input: INPUTS[3] };
  const actual = extrapolateFlutterState(anchor, 900_000, 899_500);
  assert.deepEqual({ x: actual.x, y: actual.y, velocityX: actual.velocityX, velocityY: actual.velocityY }, { x: 2, y: -1, velocityX: 1, velocityY: 1 });
});

test("clearsFlutterRing agrees with the engine's ring tolerance at the boundary", () => {
  const center = { x: 0.5, y: -0.25 };
  const tolerance = SERVER_RING_INNER_RADIUS - SERVER_AVATAR_RADIUS;
  assert.equal(clearsFlutterRing({ x: center.x, y: center.y }, center), true);
  assert.equal(clearsFlutterRing({ x: center.x + tolerance, y: center.y }, center), true);
  assert.equal(clearsFlutterRing({ x: center.x + tolerance + 0.001, y: center.y }, center), false);
});
