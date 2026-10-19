const monotonicNow = () => globalThis.performance?.now?.() ?? Date.now()
const JUMP_THRESHOLD_MS = 1_000
const SLEW_TIME_MS = 300
const DIVERGENCE_THRESHOLD_MS = 2_000

const createServerClock = (getMonotonicTime = monotonicNow) => {
    let offset = Date.now() - getMonotonicTime()
    let targetOffset = offset
    let lastRead = getMonotonicTime()
    let lastNow = 0
    let synchronized = false
    let bestRtt = Infinity
    let sampleRtts = []
    let divergentSamples = 0
    const now = () => {
        const at = getMonotonicTime()
        const elapsed = Math.max(0, at - lastRead)
        const drift = targetOffset - offset
        offset = Math.abs(drift) > JUMP_THRESHOLD_MS ? targetOffset : offset + drift * (1 - Math.exp(-elapsed / SLEW_TIME_MS))
        lastRead = at
        lastNow = Math.max(lastNow, at + offset)
        return lastNow
    }
    const anchor = (serverTime, at, oneWay) => {
        // Finish the previous slew before changing targets; reads do not determine correction speed.
        now()
        targetOffset = Number(serverTime) + Math.max(0, Number(oneWay) || 0) - at
        if(!synchronized) {
            offset = targetOffset
            lastNow = 0
            lastRead = at
        }
        synchronized = true
        divergentSamples = 0
    }
    const recordServerTime = (serverTime, at = getMonotonicTime(), oneWay = 0) => {
        if(Number.isFinite(Number(serverTime))) anchor(serverTime, at, oneWay)
    }
    const recordPong = (payload, at = getMonotonicTime()) => {
        const sent = Number(payload?.clientMonotonic), serverSent = Number(payload?.serverSentAt)
        if(!Number.isFinite(sent) || !Number.isFinite(serverSent) || sent > at) return false
        const processing = Math.max(0, serverSent - Number(payload?.serverReceivedAt ?? serverSent))
        const rtt = Math.max(0, at - sent - processing)
        sampleRtts.push(rtt)
        if(rtt > bestRtt) return false
        bestRtt = rtt
        anchor(serverSent, at, rtt / 2)
        return true
    }
    const observeServerTime = (serverTime, at = getMonotonicTime()) => {
        if(!synchronized || !Number.isFinite(Number(serverTime))) return false
        if(Math.abs(Number(serverTime) - at - targetOffset) <= DIVERGENCE_THRESHOLD_MS) {
            divergentSamples = 0
            return false
        }
        divergentSamples += 1
        if(divergentSamples < 3) return false
        divergentSamples = 0
        return true
    }
    const beginSamplingWindow = () => { bestRtt = Infinity; sampleRtts = [] }
    const getBestRtt = () => Number.isFinite(bestRtt) ? bestRtt : null
    const getJitter = () => sampleRtts.length ? Math.max(0, Math.max(...sampleRtts) - Math.min(...sampleRtts)) / 2 : 0
    return { now, recordPong, recordServerTime, observeServerTime, beginSamplingWindow, getBestRtt, getJitter, isSynchronized: () => synchronized }
}
export { createServerClock, monotonicNow }
