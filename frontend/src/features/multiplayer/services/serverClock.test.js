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

test('never reports server time moving backwards', () => {
    let monotonic = 1_000
    const clock = createServerClock(() => monotonic)
    clock.recordServerTime(50_000, monotonic)
    const first = clock.now()

    // A later message carrying an *earlier* server time (queued behind a stall, or a laggier
    // sample) must not rewind the clock - Puncture derives wheel rotation from this directly.
    monotonic += 10
    clock.recordServerTime(49_000, monotonic)
    const second = clock.now()
    assert.ok(second >= first, `clock went backwards: ${first} -> ${second}`)

    monotonic += 10
    assert.ok(clock.now() >= second)
})

test('slews small corrections instead of jumping', () => {
    let monotonic = 1_000
    const clock = createServerClock(() => monotonic)
    clock.recordServerTime(50_000, monotonic)
    clock.now()

    // A 200ms correction is under the jump threshold, so it must be absorbed gradually.
    clock.recordServerTime(50_200, monotonic)
    const afterOneRead = clock.now() - monotonic
    assert.ok(afterOneRead < 49_200, 'a sub-threshold correction must not be applied all at once')

    for(let i = 0; i < 200; i += 1) clock.now()
    assert.equal(clock.now() - monotonic, afterOneRead, 'reads without elapsed time must not slew')
    monotonic += 2_000
    assert.ok(Math.abs((clock.now() - monotonic) - 49_200) < 5, 'elapsed time converges on target')
})

test('observeServerTime only asks for a resync after repeated large divergence', () => {
    let monotonic = 1_000
    const clock = createServerClock(() => monotonic)
    clock.recordServerTime(50_000, monotonic)

    assert.equal(clock.observeServerTime(50_000, monotonic), false, 'an agreeing sample is not divergent')
    assert.equal(clock.observeServerTime(50_100, monotonic), false, 'jitter within tolerance is not divergent')

    // Three consecutive wildly-off samples indicate the anchor itself is wrong.
    assert.equal(clock.observeServerTime(90_000, monotonic), false)
    assert.equal(clock.observeServerTime(90_000, monotonic), false)
    assert.equal(clock.observeServerTime(90_000, monotonic), true)

    // Observing must never itself move the clock.
    assert.equal(clock.now(), 50_000)
})

test('exposes the best measured RTT for latency compensation reporting', () => {
    let monotonic = 1_100
    const clock = createServerClock(() => monotonic)
    assert.equal(clock.getBestRtt(), null)
    clock.beginSamplingWindow()
    clock.recordPong({ clientMonotonic: 1_000, serverSentAt: 20_000 }, monotonic)
    assert.equal(clock.getBestRtt(), 100)
    clock.recordPong({ clientMonotonic: 950, serverSentAt: 20_000 }, monotonic)
    assert.equal(clock.getBestRtt(), 100, 'a worse RTT sample should not replace the best one')
})


test('fresh sampling windows recover from sustained RTT increases and decreases', () => {
    let at = 1_000
    const clock = createServerClock(() => at)
    for(const rtt of [100, 220, 240, 80]) {
        clock.beginSamplingWindow()
        assert.equal(clock.recordPong({ clientMonotonic: at - rtt, serverSentAt: 50_000 + at }, at), true)
        assert.equal(clock.getBestRtt(), rtt)
        at += 15_000
    }
})

test('clock correction is independent of frame rate and number of consumers', () => {
    const run = (fps, consumers) => {
        let at = 1_000
        const clock = createServerClock(() => at)
        clock.recordServerTime(50_000, at)
        clock.recordServerTime(50_200, at)
        for(let frame = 0; frame < fps; frame += 1) {
            at = 1_000 + (frame + 1) * 1_000 / fps
            for(let consumer = 0; consumer < consumers; consumer += 1) clock.now()
        }
        return clock.now()
    }
    assert.ok(Math.abs(run(30, 1) - run(120, 8)) < .00001)
    assert.ok(Math.abs(run(60, 1) - run(120, 8)) < .00001)
})

test('clock sampling excludes server processing and resumes after tab suspension', () => {
    let at = 1_000
    const clock = createServerClock(() => at)
    clock.beginSamplingWindow()
    clock.recordPong({ clientMonotonic: 760, serverReceivedAt: 50_000, serverSentAt: 50_200 }, at)
    assert.equal(clock.getBestRtt(), 40)
    assert.equal(clock.now(), 50_220)
    at += 45_000
    assert.equal(clock.now(), 95_220)
    clock.beginSamplingWindow()
    clock.recordPong({ clientMonotonic: at - 220, serverReceivedAt: 95_000, serverSentAt: 95_000 }, at)
    assert.equal(clock.getBestRtt(), 220)
    const resumed = clock.now()
    at += 1_000
    assert.ok(clock.now() > resumed)
})
