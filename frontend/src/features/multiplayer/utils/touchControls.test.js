import test from 'node:test'
import assert from 'node:assert/strict'
import { joystickInput, NEUTRAL_INPUT, createDirectionalInput, canChop, isArenaTap } from './touchControls.js'

test('joystick dead zone, cardinal/diagonal mapping, and constrained thumb', () => {
    assert.deepEqual(joystickInput(9, 0).input, NEUTRAL_INPUT)
    assert.deepEqual(joystickInput(100, 0).input, { ...NEUTRAL_INPUT, right: true })
    assert.deepEqual(joystickInput(-40, -40).input, { ...NEUTRAL_INPUT, left: true, up: true })
    assert.deepEqual(joystickInput(0, 30).input, { ...NEUTRAL_INPUT, down: true })
    const { thumb } = joystickInput(300, 400)
    assert.ok(Math.abs(Math.hypot(thumb.x, thumb.y) - 48) < 0.001)
})

test('releasing joystick preserves keyboard and lifecycle resets clear all sources once', () => {
    const sent = []
    const input = createDirectionalInput((next) => sent.push(next))
    input.set('keyboard', { ...NEUTRAL_INPUT, right: true })
    input.set('joystick', { ...NEUTRAL_INPUT, up: true })
    input.set('joystick', { ...NEUTRAL_INPUT, up: true })
    assert.equal(sent.length, 2)
    input.set('joystick', NEUTRAL_INPUT)
    assert.deepEqual(sent.at(-1), { ...NEUTRAL_INPUT, right: true })
    input.reset()
    input.reset()
    assert.equal(sent.length, 4)
    assert.deepEqual(sent.at(-1), NEUTRAL_INPUT)
    input.set('joystick', { ...NEUTRAL_INPUT, left: true })
    assert.deepEqual(sent.at(-1), { ...NEUTRAL_INPUT, left: true })
})

test('all Timber inputs obey active-round, spectator, stun, and cooldown gates', () => {
    const ready = { active: true, readOnly: false, now: 200, stunnedUntil: 100, lastChopAt: 100, interval: 80 }
    assert.equal(canChop(ready), true)
    for(const change of [{ active: false }, { readOnly: true }, { stunnedUntil: 201 }, { lastChopAt: 150 }]) {
        assert.equal(canChop({ ...ready, ...change }), false)
    }
})

test('Puncture accepts primary arena taps and excludes controls and secondary pointers', () => {
    const tap = { type: 'pointerdown', isPrimary: true, button: 0, target: { closest: () => null } }
    assert.equal(isArenaTap(tap), true)
    assert.equal(isArenaTap({ ...tap, type: 'mousedown' }), false)
    assert.equal(isArenaTap({ ...tap, type: 'click' }), false)
    assert.equal(isArenaTap({ ...tap, isPrimary: false }), false)
    assert.equal(isArenaTap({ ...tap, button: 2 }), false)
    assert.equal(isArenaTap({ ...tap, target: { closest: () => ({}) } }), false)
})
