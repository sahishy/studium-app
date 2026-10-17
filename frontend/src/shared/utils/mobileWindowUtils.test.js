import test from 'node:test'
import assert from 'node:assert/strict'
import { fitMobileWindowSize, clampMobileWindowPosition } from './mobileWindowUtils.js'

test('large window and minimum dimensions fit narrow or keyboard-reduced viewports', () => {
    for(const viewport of [{ width: 320, height: 568 }, { width: 390, height: 230 }, { width: 768, height: 320 }]) {
        const size = fitMobileWindowSize({ size: { width: 780, height: 560 }, minWidth: 520, minHeight: 380, viewport })
        assert.ok(size.width <= viewport.width - 16)
        assert.ok(size.height <= viewport.height - 16)
    }
})

test('partial offscreen movement keeps measured grip and close controls visible at every edge', () => {
    const controls = { left: 132, right: 300, bottom: 48 }
    for(const viewport of [{ left: 0, top: 0, width: 320, height: 568 }, { left: 10, top: 90, width: 320, height: 220 }]) {
        for(const position of [{ x: -1000, y: -1000 }, { x: 1000, y: 1000 }, { x: 0, y: 0 }]) {
            const next = clampMobileWindowPosition({ position, viewport, controls })
            assert.ok(next.x + controls.left >= viewport.left)
            assert.ok(next.x + controls.right <= viewport.left + viewport.width)
            assert.ok(next.y >= viewport.top)
            assert.ok(next.y + controls.bottom <= viewport.top + viewport.height)
        }
        assert.ok(clampMobileWindowPosition({ position: { x: -1000, y: 0 }, viewport, controls }).x < viewport.left)
    }
})
