import test from 'node:test'
import assert from 'node:assert/strict'
import { getCrateAnimationName } from './crateAnimation.js'

test('returning to the tab ignores the retained reveal or impact motion', () => {
    for(const clip of ['RevealBurst', 'Upgrade', 'Hit_Left', 'Hit_Right', 'Hit_Back']) {
        assert.equal(getCrateAnimationName(false, { clip }), 'Idle')
        assert.equal(getCrateAnimationName(true, { clip }), clip)
    }
})

test('no active motion selects the appropriate idle', () => {
    assert.equal(getCrateAnimationName(false, null), 'Idle')
    assert.equal(getCrateAnimationName(true, null), 'WaitingIdle')
})
