import assert from 'node:assert/strict'
import test from 'node:test'
import { elementFrame, paramValues, repeatCount, shapePoints, stepParams, validateElement } from './elementModel.js'

const num = (value) => ['num', value]
const canvas = { kind: 'plane', xMin: 0, xMax: 100, yMin: 0, yMax: 100 }
const line = (id, slope, intercept) => ({
    id, kind: 'curve', x: ['var', 'u'],
    y: ['op', '+', ['op', '*', slope, ['var', 'u']], intercept], domain: [num(0), num(100)],
})

// The three subjects from the spec, in one schema, as the real test of generality.
test('supply and demand: curves, a derived intersection and a shaded region', () => {
    const element = validateElement({
        canvas,
        params: [{ id: 'shift', label: 'Supply shift', control: 'slider', min: 0, max: 60, step: 1, value: 10 }],
        derived: [{ id: 'eqX', expr: ['op', '/', ['op', '-', num(90), ['param', 'shift']], num(1.6)] }],
        shapes: [
            line('supply', num(0.8), ['param', 'shift']),
            line('demand', num(-0.8), num(90)),
            { id: 'surplus', kind: 'region', between: ['supply', 'demand'], domain: [num(0), ['derived', 'eqX']] },
            { id: 'eq', kind: 'marker', at: [['derived', 'eqX'], num(50)], glyph: 'ring' },
        ],
        readouts: [{ id: 'q', label: 'Quantity', expr: ['derived', 'eqX'], decimals: 1 }],
    })
    const frame = elementFrame(element, paramValues(element))
    assert.equal(frame.derived.eqX, 50)
    assert.equal(shapePoints(element.shapes[0], frame).length, 49)
    assert.equal(shapePoints(element.shapes[2], frame, element).length, 98)
})

test('derivative definition: a secant whose endpoints come from a difference quotient', () => {
    const element = validateElement({
        canvas,
        params: [
            { id: 'a', label: 'a', control: 'slider', min: 0, max: 8, step: 0.1, value: 3 },
            { id: 'h', label: 'h', control: 'slider', min: 0.01, max: 2, step: 0.01, value: 1 },
        ],
        derived: [
            { id: 'y1', expr: ['op', '^', ['param', 'a'], num(2)] },
            { id: 'y2', expr: ['op', '^', ['op', '+', ['param', 'a'], ['param', 'h']], num(2)] },
        ],
        shapes: [
            { id: 'parabola', kind: 'curve', x: ['var', 'u'], y: ['op', '^', ['var', 'u'], num(2)], domain: [num(0), num(10)] },
            { id: 'secant', kind: 'path', points: [[['param', 'a'], ['derived', 'y1']], [['op', '+', ['param', 'a'], ['param', 'h']], ['derived', 'y2']]] },
        ],
        readouts: [{ id: 'slope', label: 'Slope', expr: ['op', '/', ['op', '-', ['derived', 'y2'], ['derived', 'y1']], ['param', 'h']], decimals: 2 }],
    })
    const slopeAt = (h) => {
        const params = { ...paramValues(element), h }
        const { derived } = elementFrame(element, params)
        return (derived.y2 - derived.y1) / h
    }
    assert.equal(slopeAt(1), 7)
    // The lesson itself: the secant slope approaches 2a as h shrinks.
    assert.ok(Math.abs(slopeAt(0.01) - 6) < 0.02)
})

test('diagram: repeated markers and a draggable point, with no axes', () => {
    const element = validateElement({
        canvas: { ...canvas, kind: 'diagram' },
        params: [
            { id: 'count', label: 'Atoms', control: 'slider', min: 1, max: 6, step: 1, value: 4 },
            { id: 'px', label: 'x', control: 'slider', min: 0, max: 100, step: 1, value: 20 },
            { id: 'py', label: 'y', control: 'slider', min: 0, max: 100, step: 1, value: 30 },
        ],
        shapes: [
            { id: 'lattice', kind: 'marker', at: [['op', '*', ['var', 'i'], num(10)], num(50)], glyph: 'disc', repeat: { count: ['param', 'count'], as: 'i' } },
            { id: 'handle', kind: 'marker', at: [['param', 'px'], ['param', 'py']], glyph: 'cross', drag: { xParam: 'px', yParam: 'py' } },
        ],
    })
    assert.equal(element.canvas.kind, 'diagram')
    assert.equal(repeatCount(element.shapes[0], elementFrame(element, paramValues(element))), 4)
    assert.equal(repeatCount(element.shapes[0], elementFrame(element, { ...paramValues(element), count: 2 })), 2)
    assert.deepEqual(element.shapes[1].drag, { xParam: 'px', yParam: 'py' })
})

test('update rules simulate state and stay inside their declared range', () => {
    const element = validateElement({
        canvas,
        timeline: { duration: 4, loop: true, autoplay: true },
        params: [{ id: 'y', label: 'Height', control: 'slider', min: 0, max: 100, step: 1, value: 10, update: ['op', '+', ['param', 'y'], num(30)] }],
        shapes: [{ id: 'ball', kind: 'marker', at: [num(50), ['param', 'y']], glyph: 'disc' }],
    })
    assert.equal(stepParams(element, paramValues(element), 0).y, 40)
    // Clamped at the declared maximum rather than running away.
    const run = Array.from({ length: 10 }).reduce((params) => stepParams(element, params, 0), paramValues(element))
    assert.equal(run.y, 100)
})

test('references, scope and interaction rules are enforced', () => {
    const base = { canvas, params: [], derived: [], shapes: [{ id: 'c', kind: 'curve', x: ['var', 'u'], y: ['var', 'u'], domain: [num(0), num(10)] }] }
    assert.throws(() => validateElement({ ...base, shapes: [{ id: 'r', kind: 'region', between: ['missing', 'c'], domain: [num(0), num(1)] }] }), /curves that exist/)
    assert.throws(() => validateElement({ ...base, shapes: [{ ...base.shapes[0], domain: [['var', 'u'], num(10)] }] }), /can't be used here/)
    assert.throws(() => validateElement({ ...base, shapes: [{ id: 'm', kind: 'marker', at: [['var', 'i'], num(1)] }] }), /can't be used here/)
    assert.throws(() => validateElement({ ...base, params: [{ id: 'p', control: 'slider', min: 0, max: 10, update: ['var', 't'] }] }), /can't be used here/)
    assert.throws(() => validateElement({ ...base, shapes: [{ id: 'm', kind: 'marker', at: [num(1), num(1)], drag: { xParam: 'nope', yParam: 'nah' } }] }), /slider or stepper/)
    assert.throws(() => validateElement({ ...base, params: [{ id: 'p', control: 'slider', min: 0, max: 10 }], shapes: [{ id: 'm', kind: 'marker', at: [num(1), num(1)], repeat: { count: num(3) }, drag: { xParam: 'p', yParam: 'p' } }] }), /cannot be repeated/)
    assert.throws(() => validateElement({ ...base, canvas: { ...canvas, xMax: 0 } }), /positive width/)
    assert.throws(() => validateElement({ ...base, shapes: [{ id: 'p', kind: 'path', points: [[num(1), num(1)]] }] }), /at least two points/)
    assert.throws(() => validateElement({ ...base, shapes: [{ id: 'x', kind: 'script' }] }), /Unsupported element shape/)
    assert.throws(() => validateElement({ ...base, shapes: [{ id: 'i', kind: 'image', url: 'javascript:alert(1)', at: [num(1), num(1)] }] }), /valid image URL/)
})

test('publishing runs the element, drafts do not', () => {
    const blank = { canvas, params: [], derived: [], shapes: [] }
    assert.deepEqual(validateElement(blank, true).shapes, [])
    assert.throws(() => validateElement(blank), /Add a shape/)
    // Satisfies every bound and still draws nothing: the domain is never a finite number.
    const undrawable = { ...blank, shapes: [{ id: 'c', kind: 'curve', x: ['var', 'u'], y: ['var', 'u'], domain: [['op', '/', num(1), num(0)], num(10)] }] }
    assert.throws(() => validateElement(undrawable), /doesn't draw anything/)
})

test('a page variable can drive an element that never declared it', () => {
    const shared = [{ id: 'price', label: 'Price', control: 'slider', min: 0, max: 100, step: 1, value: 40, options: [] }]
    const element = validateElement({
        canvas,
        shapes: [line('demand', num(-0.8), ['param', 'price'])],
        readouts: [{ id: 'r', label: 'Price', expr: ['param', 'price'] }],
    }, false, shared)
    assert.equal(element.params.length, 0)
    const frame = elementFrame(element, paramValues(element, shared))
    // The curve sits where the shared value puts it, with nothing declared inside the element.
    assert.equal(shapePoints(element.shapes[0], frame)[0][1], 40)
    // And an element still cannot reach for a variable the page does not have.
    assert.throws(() => validateElement({ canvas, shapes: [line('d', num(1), ['param', 'nope'])] }, false, shared), /parameter that doesn't exist/)
})
