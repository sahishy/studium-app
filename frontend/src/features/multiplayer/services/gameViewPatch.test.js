import assert from 'node:assert/strict'
import test from 'node:test'
import { appendById, applyRoomPatch, applyStatePatch } from './gameViewPatch.js'

test('applyRoomPatch merges status into room.status, everything else into room.state', () => {
    const room = { uid: 'g1', modeId: 'sat-timber', ranked: true, status: 'active', state: { phase: 'timber_active', timberProgress: 3 } }
    const next = applyRoomPatch(room, { status: 'finished', timberProgress: 4 })
    assert.equal(next.status, 'finished')
    assert.equal(next.state.timberProgress, 4)
    assert.equal(next.state.phase, 'timber_active', 'untouched state keys survive')
    assert.equal(next.uid, 'g1', 'wrapper fields outside status/state are preserved')
})

test('applyRoomPatch deletes a key when the patch value is null', () => {
    const room = { status: 'active', state: { questionsById: { q1: {} }, phase: 'question_active' } }
    const next = applyRoomPatch(room, { questionsById: null })
    assert.equal('questionsById' in next.state, false)
    assert.equal(next.state.phase, 'question_active')
})

test('applyRoomPatch is a no-op passthrough when there is no patch', () => {
    const room = { status: 'active', state: { phase: 'x' } }
    assert.equal(applyRoomPatch(room, undefined), room)
})

test('applyStatePatch merges keys and deletes null-valued ones', () => {
    const state = { score: 1, pinsRemaining: 20 }
    const next = applyStatePatch(state, { score: 2, pinsRemaining: null })
    assert.equal(next.score, 2)
    assert.equal('pinsRemaining' in next, false)
})

test('appendById dedupes by id and preserves existing order', () => {
    const existing = [{ uid: 'a', v: 1 }, { uid: 'b', v: 2 }]
    const next = appendById(existing, [{ uid: 'b', v: 99 }, { uid: 'c', v: 3 }])
    assert.deepEqual(next, [{ uid: 'a', v: 1 }, { uid: 'b', v: 2 }, { uid: 'c', v: 3 }])
})

test('round-trip: applying a sequence of room/player patches matches a freshly built view', () => {
    // Mirrors backend/realtime's game-view.test.js round-trip test from the client's perspective -
    // together they pin down that both sides agree on the wire shape.
    let room = { uid: 'g1', modeId: 'sat-puncture', ranked: true, status: 'active', state: { phase: 'puncture_active', pinsRemaining: 20 } }
    let players = { p1: { score: 0 }, p2: { score: 0 } }

    const patches = [
        { room: { pinsRemaining: 19 } },
        { players: { p1: { punctureShotCount: 1, lastShotHit: false } } },
        { room: { pinsRemaining: 18 }, players: { p1: { punctureShotCount: 2 } } },
        { room: { status: 'finished', phase: 'finished' } },
    ]

    for (const patch of patches) {
        room = applyRoomPatch(room, patch.room)
        if (patch.players) {
            for (const [userId, playerPatch] of Object.entries(patch.players)) {
                players[userId] = applyStatePatch(players[userId], playerPatch)
            }
        }
    }

    assert.equal(room.status, 'finished')
    assert.equal(room.state.phase, 'finished')
    assert.equal(room.state.pinsRemaining, 18)
    assert.equal(players.p1.punctureShotCount, 2)
    assert.equal(players.p1.lastShotHit, false)
    assert.equal(players.p2.score, 0)
})
