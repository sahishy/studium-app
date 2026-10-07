import test from 'node:test'
import assert from 'node:assert/strict'
import { RARITY_GLOW_COLORS } from './crateSequence.js'

test('colored rarities keep saturated channels instead of pastel whites', () => {
    for(const [rarity, hex] of Object.entries(RARITY_GLOW_COLORS)) {
        if(rarity === 'Common') continue
        const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
        assert.equal(Math.min(...channels), 0, `${rarity} stays saturated under emission`)
        assert.equal(Math.max(...channels), 255)
    }
})
