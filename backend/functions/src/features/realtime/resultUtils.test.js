import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeRealtimeResult } from './resultUtils.js'

test('removes every bot identifier and score while preserving a human loss', () => {
    const value = sanitizeRealtimeResult({
        gameId: 'game', modeId: 'sat-timber', playerIds: ['human', 'opaque-bot'],
        botPlayerIds: ['opaque-bot'], winnerUserId: 'opaque-bot', scoreByUserId: { human: 1, 'opaque-bot': 3 },
    })
    assert.deepEqual(value.humanPlayerIds, ['human'])
    assert.equal(value.outcomeByUserId.human, 'loss')
    assert.equal(value.persistedResult.winnerUserId, null)
    assert.deepEqual(value.persistedResult.scoreByUserId, { human: 1 })
    assert.equal(JSON.stringify(value.persistedResult).includes('opaque-bot'), false)
});
