import assert from 'node:assert/strict'
import test from 'node:test'
import { createProgressBuffer } from './replayBuffer.js'

test('first push sets the displayed value immediately, no ramp-up', () => {
    const buffer = createProgressBuffer()
    buffer.push(5)
    assert.equal(buffer.read(0), 5)
})

test('a burst is drained one step at a time, not snapped', () => {
    const buffer = createProgressBuffer({ stepIntervalMs: 90 })
    buffer.push(0)
    buffer.read(0)
    buffer.push(3) // opponent gained 3 in one coalesced update
    assert.equal(buffer.read(10), 0, 'too soon to step')
    assert.equal(buffer.read(95), 1)
    assert.equal(buffer.read(100), 1, 'rate limited, still 1')
    assert.equal(buffer.read(190), 2)
    assert.equal(buffer.read(285), 3)
    assert.equal(buffer.read(400), 3, 'stays at target once caught up')
})

test('a later push while mid-drain extends the target smoothly', () => {
    const buffer = createProgressBuffer({ stepIntervalMs: 90 })
    buffer.push(0)
    buffer.read(0)
    buffer.push(2)
    assert.equal(buffer.read(90), 1)
    buffer.push(4) // opponent kept going before we finished draining the last burst
    assert.equal(buffer.read(180), 2)
    assert.equal(buffer.read(270), 3)
    assert.equal(buffer.read(360), 4)
})

test('reset snaps immediately and clears any pending drain', () => {
    const buffer = createProgressBuffer({ stepIntervalMs: 90 })
    buffer.push(0)
    buffer.read(0)
    buffer.push(10)
    buffer.read(90) // now displaying 1, mid-drain towards 10
    buffer.reset(0) // a new round started - lastStepAt resets to 0 too
    assert.equal(buffer.read(5), 0, 'snapped back to 0, not left mid-drain toward the old target')
    buffer.push(1)
    assert.equal(buffer.read(5), 0, 'rate-limited: only 5ms have elapsed since the reset')
    assert.equal(buffer.read(95), 1, '95ms since reset is enough for one step')
})

test('a decrease drains downward the same way an increase does', () => {
    const buffer = createProgressBuffer({ stepIntervalMs: 50 })
    buffer.push(5)
    buffer.read(0)
    buffer.push(2)
    assert.equal(buffer.read(50), 4)
    assert.equal(buffer.read(100), 3)
    assert.equal(buffer.read(150), 2)
})

test('non-numeric or non-finite pushes are ignored', () => {
    const buffer = createProgressBuffer()
    buffer.push(5)
    buffer.read(0)
    buffer.push('not a number')
    buffer.push(NaN)
    buffer.push(undefined)
    assert.equal(buffer.read(1000), 5)
})
