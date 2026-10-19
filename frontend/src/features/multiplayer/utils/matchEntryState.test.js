import assert from 'node:assert/strict'
import test from 'node:test'
import { getMatchRedirectPath, initialMatchEntryState, matchEntryReducer } from './matchEntryState.js'

const snapshot = (state, session, options = {}) => matchEntryReducer(state, {
    type: 'snapshot', session, delayEntry: true, now: 1000, delayMs: 3000, ...options,
})
const idle = { status: 'idle' }
const queue = { status: 'queue', modeId: 'sat-classic', queuedAt: 100 }
const assigned = { status: 'in_room', modeId: 'sat-classic', currentRoomId: 'match' }

test('a match found while queueing waits for its countdown on every screen', () => {
    const queued = snapshot(initialMatchEntryState, queue)
    const found = snapshot(queued, assigned)
    assert.deepEqual(found.pendingMatch, { roomId: 'match', deadline: 4000 })
    for(const path of ['/play', '/agenda/list', '/locker', '/profile/player']) {
        assert.equal(getMatchRedirectPath(found, path), null)
    }
    const ready = matchEntryReducer(found, { type: 'entered', roomId: 'match' })
    assert.equal(ready.pendingMatch, null)
    assert.equal(getMatchRedirectPath(ready, '/agenda/list'), '/play/game/match')
    assert.equal(getMatchRedirectPath(ready, '/play/game/match'), null)
})

test('instant assignments also receive a countdown without an intermediate queue snapshot', () => {
    const found = snapshot(snapshot(initialMatchEntryState, idle), assigned)
    assert.deepEqual(found.pendingMatch, { roomId: 'match', deadline: 4000 })
})

test('repeated session updates preserve the deadline instead of restarting it', () => {
    const found = snapshot(snapshot(initialMatchEntryState, queue), assigned)
    const updated = snapshot(found, { ...assigned, invitations: [] }, { now: 2500 })
    assert.deepEqual(updated.pendingMatch, found.pendingMatch)
})

test('entering a room consumes the countdown and later snapshots cannot reopen the toast', () => {
    const found = snapshot(snapshot(initialMatchEntryState, queue), assigned)
    const entered = matchEntryReducer(found, { type: 'entered', roomId: 'match' })
    assert.equal(snapshot(entered, assigned).pendingMatch, null)
    const released = snapshot(entered, idle)
    assert.equal(released.pendingMatch, null)
    assert.equal(snapshot(released, assigned).pendingMatch, null)
    assert.equal(getMatchRedirectPath(released, '/play'), null)
})

test('restoring an existing game and starting a solo game bypass matchmaking', () => {
    const restored = snapshot(initialMatchEntryState, assigned)
    assert.equal(restored.pendingMatch, null)
    assert.equal(getMatchRedirectPath(restored, '/play'), '/play/game/match')
    const solo = snapshot(snapshot(initialMatchEntryState, idle), assigned, { delayEntry: false })
    assert.equal(solo.pendingMatch, null)
})

test('a released assignment cancels its countdown and the next match gets a fresh deadline', () => {
    const found = snapshot(snapshot(initialMatchEntryState, queue), assigned)
    const released = snapshot(found, idle)
    assert.equal(released.pendingMatch, null)
    const next = snapshot(released, { ...assigned, currentRoomId: 'next' }, { now: 5000 })
    assert.deepEqual(next.pendingMatch, { roomId: 'next', deadline: 8000 })
    assert.equal(matchEntryReducer(next, { type: 'entered', roomId: 'match' }), next)
})
