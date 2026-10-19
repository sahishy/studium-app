import assert from 'node:assert/strict'
import test from 'node:test'
import { createRealtimeMetrics, recordActionAck, recordActionSent, recordVisualCorrection, recordAuthoritativeUpdate, recordVisualFrame, summary } from './realtimeMetrics.js'

test('action timing captures normal and impaired acknowledgement samples', () => {
    const metrics = createRealtimeMetrics()
    recordActionSent(metrics, 'fast', 'game.answer', 1000)
    recordActionAck(metrics, 'fast', { accepted: true }, 1050)
    recordActionSent(metrics, 'slow', 'game.answer', 2000)
    recordActionAck(metrics, 'slow', { accepted: false }, 2300)
    recordVisualCorrection(metrics, 2.25)
    assert.deepEqual(summary(metrics), { actions: 2, p50AckMs: 50, p95AckMs: 300, p95UpdateMs: null, p95VisualMs: null, p95LocalVisualMs: null, droppedInputs: 0, expiredActions: 0, rejectionReasons: { unspecified: 1 }, rejectedActions: 1, visualCorrections: 1, largestCorrection: 2.25, resyncs: 0, pending: 0 })
})


test('authoritative and rendered timing are measured after acknowledgement, including expired actions', () => {
    const metrics = createRealtimeMetrics()
    recordActionSent(metrics, 'shot', 'game.shoot', 1000, { sequence: 3, inputEpoch: 1 })
    recordActionAck(metrics, 'shot', { accepted: true }, 1100)
    recordAuthoritativeUpdate(metrics, { room: { state: { inputEpoch: 1 } }, players: [{ userId: 'me', state: { inputSequence: 3 } }] }, 'me', 1150)
    recordVisualFrame(metrics, 1166)
    recordActionSent(metrics, 'lost', 'game.chop', 1200)
    const result = summary(metrics, 6300)
    assert.equal(result.p95AckMs, 100)
    assert.equal(result.p95UpdateMs, 150)
    assert.equal(result.p95VisualMs, 166)
    assert.equal(result.expiredActions, 1)
})

test('early patches retain their first timing and rejected inputs never count as authoritative feedback', () => {
    const metrics = createRealtimeMetrics()
    const snapshot = { room: { state: { inputEpoch: 1 } }, players: [{ userId: 'me', state: { inputSequence: 3 } }] }
    recordActionSent(metrics, 'early', 'game.chop', 1000, { sequence: 2, inputEpoch: 1 })
    recordActionSent(metrics, 'rejected', 'game.chop', 1000, { sequence: 3, inputEpoch: 1 })
    recordAuthoritativeUpdate(metrics, snapshot, 'me', 1100)
    recordVisualFrame(metrics, 1116)
    assert.equal(summary(metrics, 1120).p95UpdateMs, null)
    recordActionAck(metrics, 'early', { accepted: true }, 1150)
    recordActionAck(metrics, 'rejected', { accepted: false, reason: 'stunned' }, 1150)
    assert.equal(summary(metrics, 1150).p95UpdateMs, 100)
    assert.equal(summary(metrics, 1150).p95VisualMs, 116)
    assert.equal(metrics.updates.length, 1)
})
