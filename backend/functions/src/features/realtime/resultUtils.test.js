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

test('keeps bot ratings out of the persisted result but exposes them for reward pricing', () => {
    const value = sanitizeRealtimeResult({
        gameId: 'game', modeId: 'sat-classic', playerIds: ['human', 'opaque-bot'],
        botPlayerIds: ['opaque-bot'], winnerUserId: 'human',
        eloByUserId: { human: 400, 'opaque-bot': 700 },
        performanceByUserId: {
            human: { faced: 10, answered: 9, correct: 7, roundsWon: 5, avgAnswerMs: 12000, byDomain: {}, byDifficulty: {} },
            'opaque-bot': { faced: 10, answered: 10, correct: 4, roundsWon: 2, avgAnswerMs: 9000, byDomain: {}, byDifficulty: {} },
        },
    })
    assert.equal(value.selfEloByUserId.human, 400)
    assert.equal(value.opponentEloByUserId.human, 700)
    assert.equal(value.performanceByUserId.human.correct, 7)
    assert.equal(value.performanceByUserId['opaque-bot'], undefined)
    assert.equal(value.persistedResult.eloByUserId, undefined)
    assert.equal(JSON.stringify(value.persistedResult).includes('opaque-bot'), false)
});

test('reports no performance and zero ratings when a mode sends neither', () => {
    const value = sanitizeRealtimeResult({
        gameId: 'game', modeId: 'blitz', playerIds: ['human'], winnerUserId: null,
    })
    assert.deepEqual(value.performanceByUserId, {})
    assert.equal(value.opponentEloByUserId.human, 0)
    assert.equal(value.persistedResult.performanceByUserId, undefined)
});
