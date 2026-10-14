import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRankedResult, getModeElo } from './ratingState.js'

test('placements clear an old provisional rating, award no deltas, and assign a rank only on completion', () => {
    let current = { elo: 64, peakElo: 64, placed: false }
    for(let index = 0; index < 3; index += 1) {
        const result = buildRankedResult({ current, outcome: 'win', opponentElo: 350 + index * 120, performance: 0.9, roundsPlayed: 6 })
        assert.equal(result.eloDelta, 0)
        assert.equal(result.placement.gamesPlayed, index + 1)
        assert.equal(result.placement.remaining, 2 - index)
        assert.equal(result.nextModeStats.placed, index === 2)
        if(index < 2) {
            assert.equal(result.nextModeStats.elo, 1)
            assert.equal(result.placement.elo, undefined)
        } else {
            assert.ok(result.nextModeStats.elo > 470)
            assert.equal(result.placement.elo, result.nextModeStats.elo)
        }
        current = result.nextModeStats
    }
})

test('placement rank reflects opponent strength and performance', () => {
    const place = (opponentElo, performance, outcome) => buildRankedResult({
        current: { placementGamesPlayed: 2, placementLog: Array.from({ length: 2 }, () => ({ opponentElo, performance, outcome })) },
        opponentElo, performance, outcome,
    }).nextModeStats.elo
    assert.ok(place(700, 0.8, 'win') > place(300, 0.8, 'win'))
    assert.ok(place(500, 0.9, 'win') > place(500, 0.1, 'win'))
    assert.ok(place(500, 0.5, 'win') > place(500, 0.5, 'loss'))
})

test('repeated losses never remove the last ELO and deltas report the actual change', () => {
    let current = { placed: true, elo: 2, peakElo: 100 }
    for(let index = 0; index < 10; index += 1) {
        const result = buildRankedResult({ current, outcome: 'loss', opponentElo: 1, roundsPlayed: 6 })
        assert.equal(result.nextModeStats.elo, 1)
        assert.equal(result.eloDelta, index === 0 ? -1 : 0)
        assert.equal(result.nextModeStats.peakElo, 100)
        current = result.nextModeStats
    }
})

test('new accounts stay at zero; played accounts recover the floor without revealing a provisional rating', () => {
    assert.equal(getModeElo(), 0)
    assert.equal(getModeElo({ gamesPlayed: 1, elo: 64 }), 1)
    assert.equal(getModeElo({ placementGamesPlayed: 1 }), 1)
    assert.equal(getModeElo({ placed: true, gamesPlayed: 5, elo: 0 }), 1)
    assert.equal(getModeElo({ placed: true, elo: 800 }), 800)
})
