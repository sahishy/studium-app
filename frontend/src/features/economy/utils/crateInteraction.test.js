import test from 'node:test'
import assert from 'node:assert/strict'
import { getCrateRarityPath, chooseImpactClip, IMPACT_CLIPS, CLIP_SECONDS, BURST_FLASH_SECONDS, RARITY_EFFECT_COLORS, getCrateProgressDots, canAcceptCrateTap, HIT_PLAYBACK_RATE, HIT_UPGRADE_CUE_SECONDS } from './crateInteraction.js'

test('server upgrade trace is monotonic, four clicks long, and ends at the granted reward', () => {
    const result = { color: { rarity: 'Epic' }, rarityPath: ['Common', 'Rare', 'Rare', 'Epic'] }
    assert.deepEqual(getCrateRarityPath(result), result.rarityPath)
    assert.notEqual(getCrateRarityPath(result), result.rarityPath)
    for(const path of [[], ['Epic', 'Rare', 'Rare', 'Epic'], ['Common', 'Common', 'Rare', 'Legendary']]) {
        assert.deepEqual(getCrateRarityPath({ ...result, rarityPath: path }), ['Common', 'Common', 'Common', 'Epic'])
    }
})
test('legacy rewards still need four clicks without inventing another reward roll', () => {
    assert.deepEqual(getCrateRarityPath({ color: { rarity: 'Legendary' } }), ['Common', 'Common', 'Common', 'Legendary'])
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
test('rapid taps are accepted during hits and upgrades, but never a fifth or a tap during the finale', () => {
    for(const phase of ['waiting', 'impact', 'upgrading']) {
        for(let used = 0; used < 4; used++) assert.equal(canAcceptCrateTap(phase, used), true)
        assert.equal(canAcceptCrateTap(phase, 4), false)
    }
    for(const phase of ['ready', 'requesting', 'bursting', 'flashing', 'revealed', 'closing']) assert.equal(canAcceptCrateTap(phase, 0), false)
    assert.ok(HIT_PLAYBACK_RATE > 1.5)
    assert.ok(HIT_UPGRADE_CUE_SECONDS < 0.2)
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
