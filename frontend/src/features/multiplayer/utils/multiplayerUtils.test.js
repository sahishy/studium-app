import test from 'node:test'
import assert from 'node:assert/strict'
import { getSpectateAvailability } from './spectateAvailability.js'

const activeGame = (overrides = {}) => ({
    uid: 'friend',
    status: 'active',
    activity: { state: 'in_game', modeId: 'sat-classic', roomId: 'room-1' },
    ...overrides,
})

test('spectating is offered only for another active multiplayer player with a room', () => {
    assert.deepEqual(getSpectateAvailability({ currentUserId: 'me', targetProfile: activeGame(), session: { status: 'idle' } }), {
        visible: true,
        disabled: false,
        roomId: 'room-1',
    })
    assert.equal(getSpectateAvailability({ currentUserId: 'friend', targetProfile: activeGame(), session: {} }).visible, false)
    assert.equal(getSpectateAvailability({ currentUserId: 'me', targetProfile: activeGame({ status: 'inactive' }), session: {} }).visible, false)
    assert.equal(getSpectateAvailability({ currentUserId: 'me', targetProfile: activeGame({ activity: { state: 'in_game', modeId: 'blitz', roomId: 'solo' } }), session: {} }).visible, false)
    assert.equal(getSpectateAvailability({ currentUserId: 'me', targetProfile: activeGame({ activity: { state: 'in_game', modeId: 'sat-classic' } }), session: {} }).visible, false)
})

test('queued viewers see a disabled spectate action', () => {
    assert.equal(getSpectateAvailability({ currentUserId: 'me', targetProfile: activeGame(), session: { status: 'queue' } }).disabled, true)
})
