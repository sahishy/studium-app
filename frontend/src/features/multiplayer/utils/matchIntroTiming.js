const INTRO_ENTRY_DELAY_MS = 30
const INTRO_SLIDE_IN_MS = 220
const INTRO_FADE_OUT_MS = 220
const MIN_INTRO_DRIFT_MS = 200

// Mount the countdown beneath the intro from the start. Its displayed time stays at
// three seconds until the intro ends, so fading never exposes the question alone.
const getMatchCountdown = (activeAt, now) => {
    const remainingMs = Math.min(3000, Math.max(0, (Number(activeAt) || 0) - Number(now)))
    return { remainingMs, seconds: Math.ceil(remainingMs / 1000) }
}

// Drift only approaches the resting edge position; it never reveals a gap at the screen edge.
const getMatchIntroOffset = (phase, side, requestedDrift = 0.5) => {
    const direction = side === 'local' ? -1 : 1
    if(phase === 'enter') return direction * 105
    if(phase === 'drift') {
        const drift = Math.min(2, Math.max(0, Number(requestedDrift) || 0))
        return drift ? direction * drift : 0
    }
    return 0
}

const getMatchIntroTiming = (introEndsAt, now, { slideInMs = INTRO_SLIDE_IN_MS, fadeOutMs = INTRO_FADE_OUT_MS } = {}) => {
    const remainingMs = Number(introEndsAt) - Number(now)
    const settleAtMs = INTRO_ENTRY_DELAY_MS + slideInMs
    if(!Number.isFinite(remainingMs) || remainingMs < settleAtMs + MIN_INTRO_DRIFT_MS + fadeOutMs) return null
    const fadeAtMs = remainingMs - fadeOutMs
    return {
        enterAtMs: INTRO_ENTRY_DELAY_MS,
        settleAtMs,
        driftMs: fadeAtMs - settleAtMs,
        fadeAtMs,
        doneAtMs: remainingMs,
    }
}

export { INTRO_ENTRY_DELAY_MS, INTRO_SLIDE_IN_MS, INTRO_FADE_OUT_MS, getMatchIntroOffset, getMatchIntroTiming, getMatchCountdown }
