import test from 'node:test'
import assert from 'node:assert/strict'
import { getMatchIntroTiming, getMatchCountdown, INTRO_SLIDE_IN_MS, INTRO_FADE_OUT_MS } from './matchIntroTiming.js'

test('intro finishes fading exactly at the server countdown deadline', () => {
    const timing = getMatchIntroTiming(14_500, 10_000)
    assert.equal(timing.doneAtMs, 4500)
    assert.equal(timing.fadeAtMs + INTRO_FADE_OUT_MS, timing.doneAtMs)
    assert.equal(timing.settleAtMs - timing.enterAtMs, INTRO_SLIDE_IN_MS)
    assert.equal(timing.settleAtMs + timing.driftMs, timing.fadeAtMs)
})

test('an early arrival spends the extra join window drifting rather than waiting after the fade', () => {
    const normal = getMatchIntroTiming(14_500, 10_000)
    const early = getMatchIntroTiming(17_500, 10_000)
    assert.equal(early.driftMs - normal.driftMs, 3000)
    assert.equal(early.doneAtMs, 7500)
    assert.equal(early.fadeAtMs + INTRO_FADE_OUT_MS, 7500)
})

test('a late arrival shortens the drift without changing the slide speeds', () => {
    const timing = getMatchIntroTiming(14_500, 12_500)
    assert.equal(timing.doneAtMs, 2000)
    assert.equal(timing.settleAtMs - timing.enterAtMs, INTRO_SLIDE_IN_MS)
    assert.equal(timing.fadeAtMs + INTRO_FADE_OUT_MS, 2000)
})

test('expired, invalid and too-short windows skip rather than covering the countdown', () => {
    for(const remaining of [-500, 0, 500, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.equal(getMatchIntroTiming(10_000 + remaining, 10_000), null)
    }
})


test('the faster 2.2 second intro still leaves room for entry and fade and ends before gameplay', () => {
    const timing = getMatchIntroTiming(12_200, 10_000)
    assert.equal(timing.doneAtMs, 2200)
    assert.ok(timing.driftMs > 1000)
    assert.equal(timing.fadeAtMs + INTRO_FADE_OUT_MS, 2200)
})

test('custom timings independently adjust entry and fade and preserve the hold duration', () => {
    const timing = getMatchIntroTiming(30 + 800 + 1500 + 600, 0, { slideInMs: 800, fadeOutMs: 600 })
    assert.equal(timing.settleAtMs - timing.enterAtMs, 800)
    assert.equal(timing.driftMs, 1500)
    assert.equal(timing.fadeAtMs + 600, timing.doneAtMs)
    // A later real match still uses the production defaults.
    const liveTiming = getMatchIntroTiming(2200, 0)
    assert.equal(liveTiming.settleAtMs - liveTiming.enterAtMs, INTRO_SLIDE_IN_MS)
    assert.equal(liveTiming.doneAtMs - liveTiming.fadeAtMs, INTRO_FADE_OUT_MS)
})

test('banners approach the screen edges with bounded drift and stay still while fading', async () => {
    const { getMatchIntroOffset } = await import('./matchIntroTiming.js')
    for(const side of ['local', 'opponent']) {
        const direction = side === 'local' ? -1 : 1
        assert.equal(getMatchIntroOffset('enter', side), direction * 105)
        assert.equal(getMatchIntroOffset('drift', side, 10), direction * 2)
        assert.equal(getMatchIntroOffset('drift', side, -5), 0)
        assert.equal(getMatchIntroOffset('settle', side, 2), 0)
        assert.equal(getMatchIntroOffset('fade', side, 2), getMatchIntroOffset('settle', side, 2))
    }
})


test('countdown is ready under the banners before fading and stays visible through the handoff', () => {
    const introEndsAt = 10_000
    const activeAt = introEndsAt + 3000
    const timing = getMatchIntroTiming(introEndsAt, 0)
    for(const now of [0, timing.fadeAtMs - 1, timing.fadeAtMs, introEndsAt - 1, introEndsAt]) {
        assert.deepEqual(getMatchCountdown(activeAt, now), { remainingMs: 3000, seconds: 3 })
    }
    assert.deepEqual(getMatchCountdown(activeAt, introEndsAt + 1000), { remainingMs: 2000, seconds: 2 })
    assert.deepEqual(getMatchCountdown(activeAt, introEndsAt + 2000), { remainingMs: 1000, seconds: 1 })
    assert.deepEqual(getMatchCountdown(activeAt, activeAt - 1), { remainingMs: 1, seconds: 1 })
    assert.deepEqual(getMatchCountdown(activeAt, activeAt), { remainingMs: 0, seconds: 0 })
    assert.deepEqual(getMatchCountdown(0, 100), { remainingMs: 0, seconds: 0 })
})
