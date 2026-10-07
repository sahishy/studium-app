import assert from 'node:assert/strict'
import test from 'node:test'
import { createRealtimeMetrics, recordActionAck, recordActionSent, recordVisualCorrection, summary } from './realtimeMetrics.js'

test('action timing captures normal and impaired acknowledgement samples', () => {
    const metrics = createRealtimeMetrics()
    recordActionSent(metrics, 'fast', 'game.answer', 1000)
    recordActionAck(metrics, 'fast', { accepted: true }, 1050)
    recordActionSent(metrics, 'slow', 'game.answer', 2000)
    recordActionAck(metrics, 'slow', { accepted: false }, 2300)
    recordVisualCorrection(metrics, 2.25)
    assert.deepEqual(summary(metrics), { actions: 2, p50AckMs: 50, p95AckMs: 300, rejectedActions: 1, visualCorrections: 1, largestCorrection: 2.25, resyncs: 0, pending: 0 })
})
