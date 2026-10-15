import assert from 'node:assert/strict'
import test from 'node:test'
import { BLOCK_KINDS, GRID, clampFrame, defaultFrame, newBlock, newPage, remapBlock, snap } from './elementDefaults.js'

test('a new block is centred on the page at a size that suits its type', () => {
    BLOCK_KINDS.forEach((kind) => {
        const frame = defaultFrame(kind.type)
        assert.deepEqual({ w: frame.w, h: frame.h }, kind.size)
        // Centred on the grid: the margins match once both are snapped.
        assert.equal(frame.x, snap((100 - frame.w) / 2))
        assert.equal(frame.y, snap((100 - frame.h) / 2))
    })
    assert.equal(newBlock('text').frame.w, 80)
    assert.equal(newPage().blocks.length, 0)
})

test('frames stay on the page and on the grid however far they are dragged', () => {
    assert.deepEqual(clampFrame({ x: -40, y: -40, w: 30, h: 20 }), { x: 0, y: 0, w: 30, h: 20 })
    assert.deepEqual(clampFrame({ x: 120, y: 120, w: 30, h: 20 }), { x: 70, y: 80, w: 30, h: 20 })
    // A block too large for the page is cut to fit rather than overflowing it.
    assert.deepEqual(clampFrame({ x: 10, y: 10, w: 400, h: 400 }), { x: 0, y: 0, w: 100, h: 100 })
    // Nothing may shrink to invisibility.
    assert.deepEqual(clampFrame({ x: 0, y: 0, w: 0, h: 1 }), { x: 0, y: 0, w: GRID * 2, h: GRID * 2 })
    // A drag that lands between grid lines is pulled onto the nearest one.
    assert.deepEqual(clampFrame({ x: 13.7, y: 26.2, w: 30, h: 20 }), { x: 12.5, y: 25, w: 30, h: 20 })
})

test('each element preset starts as the kind of thing its name promises', () => {
    assert.equal(newBlock('graph').canvas.kind, 'plane')
    assert.equal(newBlock('diagram').canvas.kind, 'diagram')
    assert.equal(newBlock('diagram').timeline, null)
    // A simulation is a diagram that runs, so it arrives with a clock already attached.
    assert.ok(newBlock('simulation').timeline)
    assert.deepEqual(['graph', 'diagram', 'simulation'].map((type) => newBlock(type).type), ['interactive', 'interactive', 'interactive'])
})

test('a dropped block keeps the position it was dropped at', () => {
    // What the builder computes: pointer offset over the page, in page percentages.
    const dropped = newBlock('quiz', { ...defaultFrame('quiz'), x: 12.4, y: 30 })
    assert.equal(dropped.frame.x, 12.5)
    assert.equal(dropped.frame.y, 30)
    assert.deepEqual({ w: dropped.frame.w, h: dropped.frame.h }, { w: 70, h: 45 })
})

test('duplicating a page rewrites every reference to its variables', () => {
    const block = {
        id: 'b', type: 'interactive', frame: defaultFrame('graph'),
        params: [{ id: 'p', update: ['op', '+', ['param', 'old'], ['num', 1]] }],
        derived: [{ id: 'd', expr: ['fn', 'max', ['param', 'old'], ['num', 2]] }],
        readouts: [{ id: 'r', expr: ['param', 'old'] }],
        shapes: [
            { id: 'c', kind: 'curve', x: ['var', 'u'], y: ['op', '*', ['param', 'old'], ['var', 'u']], domain: [['num', 0], ['param', 'old']] },
            { id: 'm', kind: 'marker', at: [['param', 'old'], ['num', 1]], radius: ['param', 'old'], repeat: { count: ['param', 'old'], as: 'i' } },
            { id: 'p2', kind: 'path', points: [[['param', 'old'], ['num', 0]], [['num', 1], ['param', 'old']]] },
        ],
    }

    const copy = remapBlock(block, { old: 'fresh' })
    const text = JSON.stringify(copy)

    assert.equal(text.includes('"old"'), false)
    assert.ok(text.includes('"fresh"'))
    // Everything else is left exactly as it was.
    assert.deepEqual(copy.shapes[0].x, ['var', 'u'])
    assert.equal(copy.shapes[1].repeat.as, 'i')
    assert.deepEqual(remapBlock({ type: 'text', text: 'hi' }, { old: 'fresh' }), { type: 'text', text: 'hi' })
})
