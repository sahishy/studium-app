import test from 'node:test'
import assert from 'node:assert/strict'
import { getPlayerActivity } from './playerActivity.js'

test('activity presentation respects offline presence and activity metadata', () => {
    assert.equal(getPlayerActivity({ status: 'inactive', activity: { state: 'in_game', modeId: 'sat-timber' } }).label, 'Offline')
    assert.equal(getPlayerActivity({ status: 'active' }).label, 'Online')
    assert.equal(getPlayerActivity({ status: 'active', activity: { state: 'in_party', modeId: 'sat-classic', partyPlayerCount: 3 } }).label, 'In party · 3 players · Classic')
    assert.equal(getPlayerActivity({ status: 'active', activity: { state: 'in_game', modeId: 'sat-timber' } }).label, 'In game · Timber')
})
