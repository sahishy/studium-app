const monotonicNow = () => globalThis.performance?.now?.() ?? Date.now()

/** Offset corrections smaller than this are slewed in gradually rather than applied as a jump. */
const JUMP_THRESHOLD_MS = 1_000
/** Fraction of the outstanding correction absorbed per read - small enough to be invisible. */
const SLEW_RATE = 0.05
/** A sample this far from the model is evidence the anchor is wrong, not just jittery. */
const DIVERGENCE_THRESHOLD_MS = 2_000
const DIVERGENCE_SAMPLES_BEFORE_RESYNC = 3

const createServerClock = (getMonotonicTime = monotonicNow) => {
    let offset = Date.now() - getMonotonicTime()
    let targetOffset = offset
    let lastNow = 0
    let bestRtt = Number.POSITIVE_INFINITY
    let previousBestRtt = Number.POSITIVE_INFINITY
    let divergentSamples = 0

    /**
     * Monotonic by construction: server time never appears to run backwards to callers, no matter
     * what arrives on the wire. Puncture derives its wheel rotation purely from this, so a
     * backwards step would physically rewind the wheel and move the target under the player.
     */
    const now = () => {
        const monotonic = getMonotonicTime()
        const drift = targetOffset - offset
        if(Math.abs(drift) > JUMP_THRESHOLD_MS) offset = targetOffset
        else offset += drift * SLEW_RATE
        lastNow = Math.max(lastNow, monotonic + offset)
        return lastNow
    }

    const anchor = (serverTime, receivedMonotonicTime, estimatedOneWayMs) => {
        targetOffset = (Number(serverTime) + Math.max(0, Number(estimatedOneWayMs) || 0)) - receivedMonotonicTime
        divergentSamples = 0
    }

    const recordServerTime = (serverTime, receivedMonotonicTime = monotonicNow(), estimatedOneWayMs = 0) => {
        if(!Number.isFinite(Number(serverTime))) return
        anchor(serverTime, receivedMonotonicTime, estimatedOneWayMs)
    }

    const recordPong = (payload, receivedMonotonicTime = monotonicNow()) => {
        const sentMonotonicTime = Number(payload?.clientMonotonic)
        const serverSentAt = Number(payload?.serverSentAt)
        if(!Number.isFinite(sentMonotonicTime) || !Number.isFinite(serverSentAt)) return false
        const rtt = Math.max(0, receivedMonotonicTime - sentMonotonicTime)
        // Keep the tightest sample, but don't let one unlucky window anchor us to a bad round trip.
        const ceiling = Math.min(bestRtt, Number.isFinite(previousBestRtt) ? previousBestRtt * 1.5 : Number.POSITIVE_INFINITY)
        if(rtt > ceiling) return false
        bestRtt = rtt
        anchor(serverSentAt, receivedMonotonicTime, rtt / 2)
        return true
    }

    /**
     * Watchdog only - deliberately does NOT anchor. Returns true when repeated samples disagree
     * with the model badly enough that a fresh RTT-measured sync is warranted (a real server clock
     * shift, or performance.now() diverging after a tab suspend).
     */
    const observeServerTime = (serverTime, receivedMonotonicTime = monotonicNow()) => {
        if(!Number.isFinite(Number(serverTime))) return false
        const impliedOffset = Number(serverTime) - receivedMonotonicTime
        if(Math.abs(impliedOffset - targetOffset) <= DIVERGENCE_THRESHOLD_MS) {
            divergentSamples = 0
            return false
        }
        divergentSamples += 1
        if(divergentSamples < DIVERGENCE_SAMPLES_BEFORE_RESYNC) return false
        divergentSamples = 0
        return true
    }

    const beginSamplingWindow = () => {
        if(Number.isFinite(bestRtt)) previousBestRtt = bestRtt
        bestRtt = Number.POSITIVE_INFINITY
    }

    const getBestRtt = () => (Number.isFinite(bestRtt) ? bestRtt : null)

    return { beginSamplingWindow, now, recordPong, recordServerTime, observeServerTime, getBestRtt }
}

export { createServerClock, monotonicNow }
