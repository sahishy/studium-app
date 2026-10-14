import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateExpr, exprScope, validateExpr } from './elementExpr.js'

const scope = exprScope({ params: ['m', 'b'], derived: ['eqX'], variables: ['u'] })
const num = (value) => ['num', value]

test('expressions validate against the scope they are authored in', () => {
    assert.deepEqual(validateExpr(['op', '+', ['op', '*', ['param', 'm'], ['var', 'u']], ['param', 'b']], scope)[0], 'op')
    assert.deepEqual(validateExpr(['derived', 'eqX'], scope), ['derived', 'eqX'])
    assert.throws(() => validateExpr(['param', 'missing'], scope), /parameter that doesn't exist/)
    assert.throws(() => validateExpr(['derived', 'missing'], scope), /doesn't exist here/)
    // `t` is a real variable but out of scope without a timeline, and `x` is not in this scope either.
    assert.throws(() => validateExpr(['var', 't'], scope), /can't be used here/)
    assert.throws(() => validateExpr(['var', 'q'], scope), /Unknown expression variable/)
})

test('the grammar rejects anything outside the whitelist', () => {
    assert.throws(() => validateExpr(['op', '%', num(1), num(2)], scope), /Unsupported operator/)
    assert.throws(() => validateExpr(['fn', 'eval', num(1)], scope), /Unsupported function/)
    assert.throws(() => validateExpr(['fn', 'pow', num(2), num(3)], scope), /Unsupported function/)
    assert.throws(() => validateExpr(['fn', 'clamp', num(1), num(0)], scope), /clamp takes 3 values/)
    assert.throws(() => validateExpr(['num', Infinity], scope), /must be finite/)
    assert.throws(() => validateExpr('m * u', scope), /Malformed expression/)
    assert.throws(() => validateExpr(['call', 'fetch'], scope), /Unsupported expression/)
})

test('cost is bounded by depth, node count and literal exponents', () => {
    const deep = (levels) => (levels ? ['op', '+', num(1), deep(levels - 1)] : num(1))
    assert.ok(validateExpr(deep(4), scope))
    assert.throws(() => validateExpr(deep(9), scope), /nested too deeply/)
    // Wide but shallow: 4-argument functions stay inside the depth cap, so the node cap is
    // what actually bounds evaluation cost.
    const wide = (levels) => (levels ? ['fn', 'max', wide(levels - 1), wide(levels - 1), wide(levels - 1), wide(levels - 1)] : num(1))
    assert.throws(() => validateExpr(wide(3), scope), /too long/)
    assert.throws(() => validateExpr(['op', '^', ['var', 'u'], ['param', 'm']], scope), /whole numbers/)
    assert.throws(() => validateExpr(['op', '^', ['var', 'u'], num(9)], scope), /whole numbers/)
    assert.ok(validateExpr(['op', '^', ['var', 'u'], num(2)], scope))
})

test('evaluation is deterministic and reports undefined results as non-finite', () => {
    const context = { params: { m: 2, b: 5 }, derived: { eqX: 10 }, variables: { u: 3 } }
    const linear = validateExpr(['op', '+', ['op', '*', ['param', 'm'], ['var', 'u']], ['param', 'b']], scope)
    assert.equal(evaluateExpr(linear, context), 11)
    assert.equal(evaluateExpr(validateExpr(['fn', 'clamp', ['derived', 'eqX'], num(0), num(4)], scope), context), 4)
    assert.ok(Number.isNaN(evaluateExpr(validateExpr(['op', '/', num(1), num(0)], scope))))
    assert.ok(Number.isNaN(evaluateExpr(validateExpr(['fn', 'sqrt', num(-1)], scope))))
    assert.ok(Number.isNaN(evaluateExpr(validateExpr(['fn', 'ln', num(0)], scope))))
    // A missing value is NaN rather than 0, so the smoke check can see it as "draws nothing".
    assert.ok(Number.isNaN(evaluateExpr(validateExpr(['param', 'm'], scope), { params: {} })))
})
