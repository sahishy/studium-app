import assert from 'node:assert/strict'
import test from 'node:test'
import { createServerClock } from './serverClock.js'

test('advances from a monotonic anchor instead of the device wall clock', () => {
    let monotonic = 1_000
    const clock = createServerClock(() => monotonic)
    clock.recordServerTime(50_000, monotonic)
    monotonic += 275
    assert.equal(clock.now(), 50_275)
})

test('keeps the lowest round-trip clock sample', () => {
    let monotonic = 1_100
    const clock = createServerClock(() => monotonic)
    clock.beginSamplingWindow()
    assert.equal(clock.recordPong({ clientMonotonic: 1_000, serverSentAt: 20_000 }, monotonic), true)
    assert.equal(clock.now(), 20_050)
    assert.equal(clock.recordPong({ clientMonotonic: 800, serverSentAt: 30_000 }, monotonic), false)
    assert.equal(clock.now(), 20_050)
})
