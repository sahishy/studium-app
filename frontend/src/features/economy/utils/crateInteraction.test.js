import test from 'node:test'
import assert from 'node:assert/strict'
import { createCrateRevealPath, getCrateRarityPath, chooseImpactClip, IMPACT_CLIPS, CLIP_SECONDS, BURST_FLASH_SECONDS, RARITY_EFFECT_COLORS, CRATE_RARITY_SHINES, getCrateProgressDots, canAcceptCrateTap, HIT_PLAYBACK_RATE, HIT_UPGRADE_CUE_SECONDS, getCrateBurstTiming } from './crateInteraction.js'
import { RARITY_ORDER } from './rarityUtils.js'

test('server upgrade trace is monotonic, four clicks long, and ends at the granted reward', () => {
    const result = { color: { rarity: 'Epic' }, rarityPath: ['Uncommon', 'Rare', 'Rare', 'Epic'] }
    assert.deepEqual(getCrateRarityPath(result), result.rarityPath)
    assert.notEqual(getCrateRarityPath(result), result.rarityPath)
    for(const path of [[], ['Epic', 'Rare', 'Rare', 'Epic'], ['Common', 'Common', 'Rare', 'Legendary']]) {
        assert.deepEqual(getCrateRarityPath({ ...result, rarityPath: path }, () => 0), ['Uncommon', 'Rare', 'Epic', 'Epic'])
    }
})
test('upgrade slots are randomized for every rarity without changing the final item', () => {
    let seed = 12913
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
    for(const [tier, rarity] of RARITY_ORDER.entries()) {
        const counts = new Map()
        for(let run = 0; run < 12000; run++) {
            const path = createCrateRevealPath(rarity, random)
            assert.equal(path.at(-1), rarity)
            let previous = 0
            const positions = []
            path.forEach((entry, index) => {
                const current = RARITY_ORDER.indexOf(entry)
                assert.ok(current - previous === 0 || current - previous === 1)
                if(current !== previous) positions.push(index)
                previous = current
            })
            assert.equal(positions.length, tier)
            const key = positions.join(',')
            counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        const combinations = [1,4,6,4,1][tier]
        assert.equal(counts.size, combinations)
        for(const count of counts.values()) assert.ok(Math.abs(count - 12000 / combinations) < 300)
    }
    assert.deepEqual(createCrateRevealPath('Legendary', () => 0.99), ['Uncommon','Rare','Epic','Legendary'])
    assert.equal(createCrateRevealPath('Legendary', () => 0.99, 6).length, 6)
    assert.throws(() => createCrateRevealPath('Legendary', Math.random, 3))
})
test('legacy rewards still need four clicks without inventing another reward roll', () => {
    assert.deepEqual(getCrateRarityPath({ color: { rarity: 'Legendary' } }), ['Uncommon', 'Rare', 'Epic', 'Legendary'])
})
test('every final rarity has four reveals with no skipped tiers, including old server paths', () => {
    for(const rarity of RARITY_ORDER) {
        const path = getCrateRarityPath({ color: { rarity }, rarityPath: [rarity, rarity, rarity, rarity] })
        assert.equal(path.length, 4)
        assert.equal(path.at(-1), rarity)
        let previous = 0
        path.forEach((entry) => {
            const current = RARITY_ORDER.indexOf(entry)
            assert.ok(current - previous === 0 || current - previous === 1)
            previous = current
        })
    }
})
test('only Rare and above have progressively larger, brighter crate shines', () => {
    assert.equal(CRATE_RARITY_SHINES.Common, undefined)
    assert.equal(CRATE_RARITY_SHINES.Uncommon, undefined)
    for(const [before, after] of [['Rare','Epic'],['Epic','Legendary']]) {
        assert.ok(CRATE_RARITY_SHINES[after].size > CRATE_RARITY_SHINES[before].size)
        assert.ok(CRATE_RARITY_SHINES[after].opacity > CRATE_RARITY_SHINES[before].opacity)
    }
})
test('impact variants do not repeat, and animation timings match the Blender frame ranges', () => {
    let previous
    for(let i = 0; i < 20; i++) {
        const next = chooseImpactClip(previous, () => 0.5)
        assert.ok(IMPACT_CLIPS.includes(next))
        assert.notEqual(next, previous)
        previous = next
    }
    assert.equal(CLIP_SECONDS.Upgrade, 40 / 24)
})
test('four dots change only for consumed chances, from left to right', () => {
    assert.deepEqual(getCrateProgressDots(0), [false,false,false,false])
    assert.deepEqual(getCrateProgressDots(1), [true,false,false,false])
    assert.deepEqual(getCrateProgressDots(3), [true,true,true,false])
    assert.deepEqual(getCrateProgressDots(4), [true,true,true,true])
})
test('four chances can be tapped rapidly; one separate tap opens without a fifth chance', () => {
    for(const phase of ['waiting', 'impact', 'upgrading']) {
        for(let used = 0; used < 4; used++) assert.equal(canAcceptCrateTap(phase, used), true)
        assert.equal(canAcceptCrateTap(phase, 4), false)
    }
    assert.equal(canAcceptCrateTap('awaitingOpen', 4), true)
    assert.equal(canAcceptCrateTap('awaitingOpen', 3), false)
    assert.equal(canAcceptCrateTap('awaitingOpen', 5), false)
    for(const phase of ['ready', 'requesting', 'bursting', 'flashing', 'revealed', 'closing']) assert.equal(canAcceptCrateTap(phase, 4), false)
    assert.ok(HIT_PLAYBACK_RATE > 1.5)
    assert.ok(HIT_UPGRADE_CUE_SECONDS < 0.2)
})
test('rarer bursts are slower and the flash stays synchronized with the explosion', () => {
    let previousDuration = 0
    for(const rarity of RARITY_ORDER) {
        const timing = getCrateBurstTiming(rarity)
        assert.ok(timing.endSeconds > previousDuration)
        assert.equal(timing.flashSeconds * timing.timeScale, BURST_FLASH_SECONDS)
        assert.equal(timing.endSeconds * timing.timeScale, CLIP_SECONDS.RevealBurst)
        assert.ok(timing.flashSeconds > 0.2, 'Shine fades before the crate flash')
        previousDuration = timing.endSeconds
    }
    assert.ok(CRATE_RARITY_SHINES.Rare.size >= 840)
})
test('the final flash is inside the burst clip and effect colors are softly tinted', () => {
    assert.equal(CLIP_SECONDS.RevealBurst, 27 / 24)
    assert.ok(BURST_FLASH_SECONDS > 0.5 && BURST_FLASH_SECONDS < CLIP_SECONDS.RevealBurst)
    for(const hex of Object.values(RARITY_EFFECT_COLORS)) {
        const channels = [1,3,5].map((offset) => parseInt(hex.slice(offset, offset+2), 16))
        assert.ok(Math.min(...channels) >= 100, 'No pure saturated channels in UI effects')
        assert.ok(Math.max(...channels) < 255)
    }
})
