const LIMIT = 100

const createRealtimeMetrics = () => ({ pending: new Map(), samples: [], rejectedActions: 0, resyncs: 0, visualCorrections: 0, largestCorrection: 0 })
const recordActionSent = (metrics, id, type, at) => {
    metrics.pending.set(id, { type, at })
    if(metrics.pending.size > LIMIT) metrics.pending.delete(metrics.pending.keys().next().value)
}
const recordActionAck = (metrics, id, payload, at) => {
    const pending = metrics.pending.get(id)
    if(!pending) return null
    metrics.pending.delete(id)
    const sample = { type: pending.type, ackMs: Math.max(0, at - pending.at), accepted: payload?.accepted !== false }
    metrics.samples.push(sample)
    if(metrics.samples.length > LIMIT) metrics.samples.shift()
    if(!sample.accepted) metrics.rejectedActions += 1
    return sample
}
const recordVisualCorrection = (metrics, magnitude = 1) => {
    metrics.visualCorrections += 1
    metrics.largestCorrection = Math.max(metrics.largestCorrection, Number(magnitude) || 0)
}
const summary = (metrics) => {
    const sorted = metrics.samples.map((sample) => sample.ackMs).sort((a, b) => a - b)
    const percentile = (part) => sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * part) - 1)]) : null
    return { actions: sorted.length, p50AckMs: percentile(0.5), p95AckMs: percentile(0.95), rejectedActions: metrics.rejectedActions, visualCorrections: metrics.visualCorrections, largestCorrection: metrics.largestCorrection, resyncs: metrics.resyncs, pending: metrics.pending.size }
}

export { createRealtimeMetrics, recordActionAck, recordActionSent, recordVisualCorrection, summary }
