const LIMIT = 100
const boundedPush = (list, value) => { list.push(value); if(list.length > LIMIT) list.shift() }
const createRealtimeMetrics = () => ({ pending: new Map(), waitingUpdates: new Map(), pendingVisual: [], samples: [], updates: [], visuals: [], localVisuals: [], droppedInputs: 0, expiredActions: 0, rejectedActions: 0, rejectionReasons: {}, resyncs: 0, visualCorrections: 0, largestCorrection: 0 })
const recordActionSent = (metrics, id, type, at, payload = {}) => {
    metrics.pending.set(id, { type, at, payload })
    if(metrics.pending.size > LIMIT) { metrics.pending.delete(metrics.pending.keys().next().value); metrics.expiredActions += 1 }
}
const recordActionAck = (metrics, id, payload, at) => {
    const pending = metrics.pending.get(id)
    if(!pending) return null
    metrics.pending.delete(id)
    const sample = { type: pending.type, ackMs: Math.max(0, at - pending.at), accepted: payload?.accepted !== false }
    pending.accepted = sample.accepted
    boundedPush(metrics.samples, sample)
    if(!sample.accepted) {
        metrics.rejectedActions += 1
        const reason = payload?.reason || 'unspecified'
        metrics.rejectionReasons[reason] = (metrics.rejectionReasons[reason] || 0) + 1
    } else if(pending.authoritativeAt != null) {
        boundedPush(metrics.updates, Math.max(0, pending.authoritativeAt - pending.at))
        if(pending.visualAt != null) boundedPush(metrics.visuals, Math.max(0, pending.visualAt - pending.at))
    } else {
        metrics.waitingUpdates.set(id, pending)
        if(metrics.waitingUpdates.size > LIMIT) { metrics.waitingUpdates.delete(metrics.waitingUpdates.keys().next().value); metrics.expiredActions += 1 }
    }
    return sample
}
const recordAuthoritativeUpdate = (metrics, snapshot, userId, at) => {
    const state = snapshot.players?.find((p) => p.userId === userId)?.state
    if(!state) return
    for(const [id, action] of [...metrics.pending, ...metrics.waitingUpdates]) {
        if(action.authoritativeAt != null) continue
        const p = action.payload
        const currentEpoch = snapshot.room?.state?.inputEpoch
        if(p.inputEpoch != null && p.inputEpoch !== currentEpoch) continue
        const sequenceSeen = p.sequence != null && Number(state.inputSequence ?? state.flutterInputSequence ?? -1) >= p.sequence
        const idSeen = p.clientActionId && (state.lastClientActionId === p.clientActionId || state.punctureRecentShots?.some((shot) => shot.clientActionId === p.clientActionId))
        const answerSeen = action.type === 'game.answer' && snapshot.events?.some((event) => event.type === 'ANSWER_SUBMITTED' && event.actorUserId === userId && event.data?.questionId === p.questionId)
        if(!sequenceSeen && !idSeen && !answerSeen) continue
        action.authoritativeAt = at
        if(action.accepted) boundedPush(metrics.updates, Math.max(0, at - action.at))
        metrics.pendingVisual.push(action)
        metrics.waitingUpdates.delete(id)
    }
}
const recordVisualFrame = (metrics, at) => {
    for(const action of metrics.pendingVisual) {
        action.visualAt = at
        if(action.accepted) boundedPush(metrics.visuals, Math.max(0, at - action.at))
    }
    metrics.pendingVisual = []
}
const recordLocalVisual = (metrics, milliseconds) => boundedPush(metrics.localVisuals, Math.max(0, milliseconds))
const recordVisualCorrection = (metrics, magnitude = 1) => {
    metrics.visualCorrections += 1
    metrics.largestCorrection = Math.max(metrics.largestCorrection, Number(magnitude) || 0)
}
const percentile = (values, fraction) => {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]) : null
}
const summary = (metrics, now = globalThis.performance?.now?.() ?? Date.now()) => {
    for(const map of [metrics.pending, metrics.waitingUpdates]) for(const [id, pending] of map) {
        if(now - pending.at > 5_000) { map.delete(id); metrics.expiredActions += 1 }
    }
    const acks = metrics.samples.map((sample) => sample.ackMs)
    return { actions: acks.length, p50AckMs: percentile(acks, .5), p95AckMs: percentile(acks, .95), p95UpdateMs: percentile(metrics.updates, .95), p95VisualMs: percentile(metrics.visuals, .95), p95LocalVisualMs: percentile(metrics.localVisuals, .95), droppedInputs: metrics.droppedInputs, expiredActions: metrics.expiredActions, rejectionReasons: { ...metrics.rejectionReasons }, rejectedActions: metrics.rejectedActions, visualCorrections: metrics.visualCorrections, largestCorrection: metrics.largestCorrection, resyncs: metrics.resyncs, pending: metrics.pending.size }
}
export { createRealtimeMetrics, recordActionAck, recordActionSent, recordAuthoritativeUpdate, recordVisualFrame, recordLocalVisual, recordVisualCorrection, summary }
