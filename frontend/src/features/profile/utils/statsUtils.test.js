import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createServer } from 'vite'

let server
let stats
before(async () => {
    server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
    stats = await server.ssrLoadModule('/src/features/profile/utils/statsUtils.jsx')
})
after(async () => { await server?.close() })

test('zero uses the Unranked icon and one uses Bronze I', async () => {
    const unrankedIcon = (await server.ssrLoadModule('/src/assets/images/ranked/unranked.svg')).default
    const bronzeIcon = (await server.ssrLoadModule('/src/assets/images/ranked/bronze_I.svg')).default
    const zero = stats.getRankInfoFromElo(0)
    assert.equal(zero.tierName, 'Unranked')
    assert.equal(zero.imageSrc, unrankedIcon)
    const one = stats.getRankInfoFromElo(1)
    assert.equal(one.tierName, 'Bronze')
    assert.equal(one.tier, 'I')
    assert.equal(one.imageSrc, bronzeIcon)
    assert.equal(stats.getRankInfoFromElo(700, { placed: false }).tierName, 'Unranked')
})

test('placements expose completion while suppressing a stale provisional rating', () => {
    const userStats = { play: { 'sat-classic': { elo: 64, peakElo: 64, placementGamesPlayed: 1, gamesPlayed: 1 } } }
    const placement = stats.getPlacementState(userStats, 'sat-classic')
    assert.deepEqual(placement, { placed: false, gamesPlayed: 1, required: 3, remaining: 2 })
    const mode = stats.getModeStats(userStats, { id: 'sat-classic' })
    assert.equal(mode.elo, 1)
    assert.equal(mode.peakElo, 0)
    assert.equal(stats.getTotalElo(userStats), 1)
})

test('existing placed players at zero display the participation floor', () => {
    const userStats = { play: { 'sat-classic': { placed: true, gamesPlayed: 10, elo: 0 } } }
    assert.equal(stats.getModeStats(userStats, { id: 'sat-classic' }).elo, 1)
    assert.equal(stats.getTotalElo(userStats), 1)
    assert.equal(stats.getTotalElo({}), 0)
})
