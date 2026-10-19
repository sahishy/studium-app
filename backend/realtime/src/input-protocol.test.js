import assert from 'node:assert/strict';
import test from 'node:test';
import { InputValidator, syncInputState, upgradedRoom } from './input-protocol.ts';
const fixture = () => {
    const game = { gameId: 'room', modeId: 'sat-timber', state: { phase: 'timber_active', currentQuestionId: 'q1' }, privateState: { netcodeVersion: 4 }, players: [{ userId: 'one', state: {} }] };
    syncInputState(game);
    const action = (extra = {}) => ({ id: 'a', type: 'game.chop', payload: { sequence: 1, occurredAt: 1000, inputEpoch: game.state.inputEpoch, roundToken: game.state.roundToken, clientActionId: 'a', ...extra } });
    return { game, action, validator: new InputValidator() };
};
test('invalid timestamps and old scope cannot mutate an input stream', () => {
    const f = fixture();
    assert.equal(f.validator.validate(f.game, 'one', f.action({ occurredAt: 749 }), 1000).reason, 'invalid_time');
    assert.equal(f.validator.validate(f.game, 'one', f.action({ occurredAt: 1026 }), 1000).reason, 'invalid_time');
    assert.equal(f.validator.validate(f.game, 'one', f.action({ inputEpoch: -1 }), 1000).reason, 'stale_epoch');
    assert.equal(f.validator.validate(f.game, 'one', f.action({ occurredAt: 1020 }), 1000).at, 1000);
});
test('deduplication is bounded and never carries a result into a different round', () => {
    const f = fixture();
    f.validator.validate(f.game, 'one', f.action(), 1000);
    for(let i = 0; i < 140; i++) f.validator.record('one', f.action({ clientActionId: `a${i}`, sequence: i }), { accepted: true }, 1000 + i * 50);
    assert.equal(f.validator.streams.get('one').replies.size, 128);
    assert.equal(f.validator.validate(f.game, 'one', f.action({ clientActionId: 'a139', sequence: 139 }), 8000).duplicate.accepted, true);
    f.game.state.roundToken = 'new';
    assert.equal(f.validator.validate(f.game, 'one', f.action({ clientActionId: 'a139', sequence: 139, roundToken: 'old' }), 8000).reason, 'stale_round');
});
test('receipt budgets permit bounded batching and stop sustained floods', () => {
    const f = fixture();
    for(let i = 0; i < 5; i++) assert.equal(f.validator.validate(f.game, 'one', f.action({ sequence: i }), 1000).at, 1000);
    assert.equal(f.validator.validate(f.game, 'one', f.action({ sequence: 6 }), 1000).reason, 'message_budget');
    assert.equal(f.validator.validate(f.game, 'one', f.action({ sequence: 7 }), 1050).at, 1000);
});
test('rollout assignment is deterministic at 0/10/50/100 percent', () => {
    const rooms = Array.from({ length: 1000 }, (_, i) => `room-${i}`);
    assert.equal(rooms.filter((id) => upgradedRoom(id, '0')).length, 0);
    assert.equal(rooms.filter((id) => upgradedRoom(id, '100')).length, 1000);
    const cohort = rooms.filter((id) => upgradedRoom(id, '10'));
    assert.ok(cohort.length > 70 && cohort.length < 130);
    assert.ok(cohort.every((id) => upgradedRoom(id, '50')));
});
test('rejected results are idempotent without advancing accepted motion time', () => {
    const f = fixture();
    f.validator.validate(f.game, 'one', f.action(), 1000);
    f.validator.record('one', f.action(), { accepted: false, reason: 'stunned' }, 1000);
    assert.equal(f.validator.streams.get('one').at, 0);
    assert.equal(f.validator.validate(f.game, 'one', f.action(), 1100).duplicate.reason, 'stunned');
    f.validator.remember('one', f.action({ clientActionId: 'late', sequence: 5 }), { accepted: false, reason: 'invalid_time' });
    assert.equal(f.validator.streams.get('one').sequence, 1);
});
