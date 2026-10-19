import assert from 'node:assert/strict'
import test from 'node:test'
import { GameConnection } from './gameConnection.js'

const fixture = () => {
    const messages = [], events = []
    let open = true
    const connection = new GameConnection({ isOpen: () => open, now: () => 1000, userId: () => 'p1',
        transmit: (type, payload) => { messages.push({ type, payload }); return `m${messages.length}` },
        onReset: () => events.push('reset'), onReady: () => events.push('ready') })
    const snapshot = (epoch = 1) => ({ room: { state: { netcodeVersion: 4, roundToken: 'round-a', inputEpoch: epoch, currentQuestionId: 'q1' } }, players: [{ userId: 'p1', state: { inputSequence: 8 } }] })
    return { connection, messages, events, snapshot, setOpen: (value) => { open = value } }
}
test('offline and syncing presses never replay; readiness waits for a current snapshot and clock', () => {
    const f = fixture()
    assert.equal(f.connection.send('game.chop').sent, false)
    f.connection.opened()
    f.connection.receivedClock()
    assert.deepEqual(f.events, [])
    f.connection.receivedSnapshot(f.snapshot())
    assert.deepEqual(f.events, ['ready'])
    assert.equal(f.messages.length, 0)
    const result = f.connection.send('game.chop', { clientActionId: 'one', side: 'left' })
    assert.equal(result.sent, true)
    assert.equal(result.payload.sequence, 9)
    assert.equal(result.payload.roundToken, 'round-a')
    f.setOpen(false); f.connection.closed()
    for(let i = 0; i < 10; i += 1) assert.equal(f.connection.send('game.shoot').sent, false)
    f.setOpen(true); f.connection.opened()
    f.connection.receivedSnapshot(f.snapshot())
    assert.equal(f.events.at(-1), 'reset')
    f.connection.receivedClock()
    assert.equal(f.events.at(-1), 'ready')
    assert.equal(f.messages.length, 1)
})
test('leave intent is retained once and recovery epochs invalidate prediction before resuming', () => {
    const f = fixture()
    f.connection.opened()
    f.connection.send('game.leave'); f.connection.send('game.leave')
    f.connection.receivedSnapshot(f.snapshot()); f.connection.receivedClock()
    assert.equal(f.messages.filter((m) => m.type === 'game.leave').length, 1)
    f.connection.receivedSnapshot(f.snapshot(2), false)
    assert.equal(f.connection.send('game.flutterInput').sent, false)
    f.connection.receivedSnapshot(f.snapshot(2))
    assert.deepEqual(f.events, ['ready', 'reset', 'ready'])
})
