import test from 'node:test'
import assert from 'node:assert/strict'
import { getCrateOpeningOffset } from './crateLayout.js'

test('opening centers inside the Locker, excluding the sidebar', () => {
    const locker = { left: 224, top: 0, width: 1216, height: 900 }
    const anchor = { left: 320, top: 160, width: 800, height: 660 }
    const offset = getCrateOpeningOffset(anchor, locker)
    assert.deepEqual(offset, { x: 112, y: -40 })
    assert.equal(anchor.left + anchor.width / 2 + offset.x, 832)
    assert.notEqual(832, 1440 / 2)
})

test('opening follows mobile and resized Locker bounds without sidebar assumptions', () => {
    assert.deepEqual(getCrateOpeningOffset(
        { left: 16, top: 180, width: 358, height: 400 },
        { left: 0, top: 0, width: 390, height: 844 },
    ), { x: 0, y: 42 })
    assert.deepEqual(getCrateOpeningOffset(
        { left: 340, top: 100, width: 520, height: 500 },
        { left: 240, top: 0, width: 960, height: 720 },
    ), { x: 120, y: 10 })
})
