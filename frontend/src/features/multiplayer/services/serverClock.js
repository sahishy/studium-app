const monotonicNow = () => globalThis.performance?.now?.() ?? Date.now()

const createServerClock = (getMonotonicTime = monotonicNow) => {
    let anchorServerTime = Date.now()
    let anchorMonotonicTime = getMonotonicTime()
    let bestRtt = Number.POSITIVE_INFINITY

    const now = () => anchorServerTime + (getMonotonicTime() - anchorMonotonicTime)

    const recordServerTime = (serverTime, receivedMonotonicTime = monotonicNow(), estimatedOneWayMs = 0) => {
        if(!Number.isFinite(Number(serverTime))) return
        anchorServerTime = Number(serverTime) + Math.max(0, Number(estimatedOneWayMs) || 0)
        anchorMonotonicTime = receivedMonotonicTime
    }

    const recordPong = (payload, receivedMonotonicTime = monotonicNow()) => {
        const sentMonotonicTime = Number(payload?.clientMonotonic)
        const serverSentAt = Number(payload?.serverSentAt)
        if(!Number.isFinite(sentMonotonicTime) || !Number.isFinite(serverSentAt)) return false
        const rtt = Math.max(0, receivedMonotonicTime - sentMonotonicTime)
        if(rtt > bestRtt) return false
        bestRtt = rtt
        recordServerTime(serverSentAt, receivedMonotonicTime, rtt / 2)
        return true
    }

    const beginSamplingWindow = () => { bestRtt = Number.POSITIVE_INFINITY }

    return { beginSamplingWindow, now, recordPong, recordServerTime }
}

export { createServerClock, monotonicNow }
