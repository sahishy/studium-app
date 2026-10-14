import assert from 'node:assert/strict'
import test from 'node:test'
import { axisPoint, smoothRadarPath } from './masteryUtils.js'

const options = { radius: 100, center: { x: 150, y: 150 } }
const segments = (values) => smoothRadarPath(values, options).split(' C ').slice(1)
    .map((segment) => segment.match(/-?\d+(?:\.\d+)?/g).map(Number))

test('a low domain between high domains keeps broad curve handles', () => {
    const values = [0.9, 0.9, 0.9, 0.9, 0.05, 0.9, 0.9, 0.9]
    const curve = segments(values)
    const point = axisPoint(4, values.length, 5, options.center)
    const outgoing = curve[4]
    assert.ok(Math.hypot(outgoing[0] - point.x, outgoing[1] - point.y) > 20)
    const incoming = curve[3]
    assert.ok(Math.abs((point.x - incoming[2]) - (outgoing[0] - point.x)) < 0.02)
    assert.ok(Math.abs((point.y - incoming[3]) - (outgoing[1] - point.y)) < 0.02)
})

test('uneven scores retain their actual positions and smooth slope and curvature at every join', () => {
    const values = [0.9, 0.7, 0.35, 0.95, 0.1, 0.6, 0.8, 0.4]
    const curve = segments(values)
    curve.forEach((outgoing, index) => {
        const incoming = curve[(index + values.length - 1) % values.length]
        const point = axisPoint(index, values.length, 100 * values[index], options.center)
        assert.ok(Math.hypot(incoming[4] - point.x, incoming[5] - point.y) < 0.01)
        assert.ok(Math.abs((point.x - incoming[2]) - (outgoing[0] - point.x)) < 0.02)
        assert.ok(Math.abs((point.y - incoming[3]) - (outgoing[1] - point.y)) < 0.02)
        assert.ok(Math.abs((point.x - 2 * incoming[2] + incoming[0]) - (point.x - 2 * outgoing[0] + outgoing[2])) < 0.05)
        assert.ok(Math.abs((point.y - 2 * incoming[3] + incoming[1]) - (point.y - 2 * outgoing[1] + outgoing[3])) < 0.05)
    })
})
