import test from 'node:test'
import assert from 'node:assert/strict'
import { CRATE_RARITIES, rollCrateRarityPath } from './crateRolls.js'

const odds = Object.freeze({ Common: 60, Uncommon: 25, Rare: 11, Epic: 3, Legendary: 1 })
test('the final rarity is rolled first; reveals only hold or advance one tier', () => {
    const rolls = [0.97, 0.99, 0, 0]
    assert.deepEqual(rollCrateRarityPath(odds, () => rolls.shift()), ['Common', 'Uncommon', 'Rare', 'Epic'])
    assert.deepEqual(rollCrateRarityPath(odds, () => 0), ['Common', 'Common', 'Common', 'Common'])
    assert.deepEqual(rollCrateRarityPath(odds, () => 0.9999), ['Uncommon', 'Rare', 'Epic', 'Legendary'])
})
test('four upgrade opportunities preserve the published final reward distribution', () => {
    let seed = 123456
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
    const counts = Object.fromEntries(CRATE_RARITIES.map((rarity) => [rarity, 0]))
    for(let i = 0; i < 100000; i++) {
        const path = rollCrateRarityPath(odds, random)
        assert.equal(path.length, 4)
        path.forEach((rarity, index) => {
            const before = index === 0 ? 0 : CRATE_RARITIES.indexOf(path[index - 1])
            const change = CRATE_RARITIES.indexOf(rarity) - before
            assert.ok(change === 0 || change === 1)
        })
        counts[path.at(-1)]++
    }
    for(const rarity of CRATE_RARITIES) assert.ok(Math.abs(counts[rarity] / 1000 - odds[rarity]) < 0.6, rarity)
})
test('reveal timing cannot change the rarity already selected at purchase', () => {
    for(const presentationRoll of [0, 0.4, 0.99999]) {
        let first = true
        const path = rollCrateRarityPath(odds, () => {
            if(first) { first = false; return 0.97 }
            return presentationRoll
        })
        assert.equal(path.at(-1), 'Epic')
    }
})
