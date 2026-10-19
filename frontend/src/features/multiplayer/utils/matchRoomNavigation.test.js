import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldReturnToPlay } from './matchRoomNavigation.js'

const activeMatch = {
    session: { status: 'in_room', currentRoomId: 'match' },
    roomId: 'match',
    roomLoading: false,
    playersLoading: false,
    isGameFinished: false,
    players: [{ userId: 'human' }, { userId: 'bot' }],
    userId: 'human',
}

test('session release before final game update keeps the participant on the match page', () => {
    assert.equal(shouldReturnToPlay(activeMatch), false)
    const released = { ...activeMatch, session: { status: 'idle', currentRoomId: null } }
    assert.equal(shouldReturnToPlay(released), false)
    assert.equal(shouldReturnToPlay({ ...released, isGameFinished: true }), false)
})

test('navigation waits for room and player subscriptions when the session is already idle', () => {
    const loading = { ...activeMatch, session: { status: 'idle' }, players: [] }
    assert.equal(shouldReturnToPlay({ ...loading, roomLoading: true }), false)
    assert.equal(shouldReturnToPlay({ ...loading, playersLoading: true }), false)
    assert.equal(shouldReturnToPlay(loading), true)
})

test('a final result received before session release stays open too', () => {
    assert.equal(shouldReturnToPlay({ ...activeMatch, isGameFinished: true }), false)
})

test('a different assigned room and non-participants still leave stale match pages', () => {
    assert.equal(shouldReturnToPlay({ ...activeMatch, session: { status: 'in_room', currentRoomId: 'next' } }), true)
    assert.equal(shouldReturnToPlay({ ...activeMatch, session: { status: 'idle' }, userId: 'stranger' }), true)
})
