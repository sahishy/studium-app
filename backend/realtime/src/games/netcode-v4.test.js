import assert from 'node:assert/strict';
import test from 'node:test';
import { createFlutterGame } from './flutter.ts';
import { createPunctureGame, STUN_MS } from './puncture.ts';
import { predictShot } from '../../../../frontend/src/features/multiplayer/games/puncture/puncturePrediction.js';

const questions = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, questionType: 'mcq', prompt: 'A', choices: [{ id: 'A', label: 'A' }], correctAnswer: 'A' }));
const context = (now, at = now) => ({ now, nowCompensated: at, addEvent: () => {} });
const setup = (create, modeId) => {
    const engine = create();
    const game = { gameId: 'v4', modeId, ranked: false, status: 'active', players: ['p1', 'p2'].map((userId) => ({ userId, state: {} })), state: {}, privateState: { netcodeVersion: 4 }, events: [], chat: [], startedAt: 1000 };
    engine.initialize(game, questions, context(1000));
    for(const userId of ['p1', 'p2']) engine.handleAction(game, userId, { id: userId, type: 'game.answer', payload: { submittedResponse: 'A' } }, context(5000));
    engine.handleDeadline(game, context(game.state.phaseDeadlineAt));
    return { engine, game, start: game.state.flutterRoundStartedAt || game.state.punctureRoundStartedAt };
};
test('Puncture uses one validated time for collision, cooldown, impact and stun', () => {
    const { game, engine, start } = setup(createPunctureGame, 'sat-puncture');
    const at = start + 100, now = at + 120;
    const prediction = predictShot({ shotAt: at, roundStartedAt: start, rotationTurnsPerSecond: game.state.rotationTurnsPerSecond, generatedPinAngles: [], attachedPinAngles: [] });
    game.state.generatedPinAngles = [prediction.attachedAngle];
    const reply = engine.handleAction(game, 'p1', { id: 'shot', type: 'game.shoot', payload: { clientActionId: 'shot', occurredAt: at } }, context(now, at));
    assert.equal(reply.reply.payload.shot.hit, true);
    assert.equal(reply.reply.payload.shot.shotAt, at);
    assert.equal(reply.reply.payload.shot.impactAt, at + 75);
    assert.equal(game.players[0].state.lastShotAt, at);
    assert.equal(game.players[0].state.stunnedUntil, at + STUN_MS);
});
test('Flutter samples ring motion at the plane while preserving controls from after it', () => {
    const { game, engine, start } = setup(createFlutterGame, 'sat-flutter');
    const plane = game.state.flutterCurrentRingPassAt;
    const neutral = { up: false, down: false, left: false, right: false };
    // These arrived before adjudication, but after the plane. They must not change its verdict.
    engine.handleAction(game, 'p1', { id: 'move', type: 'game.flutterInput', payload: { sequence: 1, ...neutral, right: true } }, context(plane + 50, plane + 10));
    const presentX = game.players[0].state.flutterX;
    assert.ok(presentX > 0);
    engine.handleDeadline(game, context(game.state.phaseDeadlineAt));
    assert.equal(game.state.flutterRingIndex, 1);
    assert.equal(game.state.phase, 'flutter_active');
    assert.ok(game.players[0].state.flutterX >= presentX - 1e-10);
    assert.equal(game.players[0].state.flutterInput.right, true);
    const oldRing = game.state.flutterRingIndex;
    engine.handleAction(game, 'p1', { id: 'release', type: 'game.flutterInput', payload: { sequence: 2, ...neutral } }, context(plane + 130, plane - 20));
    assert.equal(game.state.flutterRingIndex, oldRing);
    assert.equal(game.players[0].state.flutterInput.right, false);
    assert.ok(game.players[0].state.flutterLastUpdatedAt >= plane);
    assert.ok(start < plane);
});
