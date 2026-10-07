import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeActivityUpdates } from './activityService.js'

test('normalizes public player activity updates', () => {
    assert.deepEqual(normalizeActivityUpdates({ updates: [
        { userId: 'one', activity: { state: 'online' } },
        { userId: 'two', activity: { state: 'in_party', modeId: 'sat-classic', partyPlayerCount: 2 } },
        { userId: 'three', activity: { state: 'in_game', modeId: 'sat-timber', roomId: 'room-three' } },
    ] }), [
        { userId: 'one', activity: { state: 'online' } },
        { userId: 'two', activity: { state: 'in_party', modeId: 'sat-classic', partyPlayerCount: 2 } },
        { userId: 'three', activity: { state: 'in_game', modeId: 'sat-timber', roomId: 'room-three' } },
    ])
})

test('requires room identifiers only for in-game activity and rejects invalid metadata', () => {
    assert.throws(() => normalizeActivityUpdates({ updates: [{ userId: 'one', activity: { state: 'in_game', modeId: 'sat-classic', partyPlayerCount: 2 } }] }))
    assert.throws(() => normalizeActivityUpdates({ updates: [{ userId: 'one', activity: { state: 'in_game', modeId: 'sat-classic' } }] }))
    assert.throws(() => normalizeActivityUpdates({ updates: [{ userId: 'one', activity: { state: 'in_party', modeId: 'sat-classic', partyPlayerCount: 2, roomId: 'private-game-id' } }] }))
    assert.throws(() => normalizeActivityUpdates({ updates: [{ userId: 'one', activity: { state: 'in_party', modeId: 'sat-classic', partyPlayerCount: 0 } }] }))
    assert.throws(() => normalizeActivityUpdates({ updates: [{ userId: 'one', activity: { state: 'online', modeId: 'private-game-id' } }] }))
})
