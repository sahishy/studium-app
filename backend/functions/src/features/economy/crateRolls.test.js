import test from 'node:test'
import assert from 'node:assert/strict'
import { CRATE_RARITIES, rollCrateRarityPath } from './crateRolls.js'

const odds = Object.freeze({ Common: 60, Uncommon: 25, Rare: 11, Epic: 3, Legendary: 1 })
test('four server rolls only hold or increase rarity, and cannot reroll downward', () => {
    const rolls = [0.9, 0.97, 0.2, 0.9999]
    assert.deepEqual(rollCrateRarityPath(odds, () => rolls.shift()), ['Uncommon', 'Rare', 'Rare', 'Legendary'])
    assert.deepEqual(rollCrateRarityPath(odds, () => 0), ['Common', 'Common', 'Common', 'Common'])
})
test('four upgrade opportunities preserve the published final reward distribution', () => {
    let seed = 123456
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
    const counts = Object.fromEntries(CRATE_RARITIES.map((rarity) => [rarity, 0]))
    for(let i = 0; i < 100000; i++) {
        const path = rollCrateRarityPath(odds, random)
        assert.equal(path.length, 4)
        assert.ok(path.every((rarity, index) => index === 0 || CRATE_RARITIES.indexOf(rarity) >= CRATE_RARITIES.indexOf(path[index - 1])))
        counts[path.at(-1)]++
    }
    for(const rarity of CRATE_RARITIES) assert.ok(Math.abs(counts[rarity] / 1000 - odds[rarity]) < 0.6, rarity)
})
