// Smooths a bursty, monotonically-changing numeric counter (opponent chop/shot progress) into a
// steadily-advancing display value, instead of snapping straight to whatever the latest
// game.update says. Broadcasts are coalesced server-side (MIN_BROADCAST_INTERVAL_MS, see
// servers/game.ts) and a single tick can advance a bot by at most a few actions (see
// MAX_BOT_ACTIONS_PER_TICK), so a "burst" here is small and bounded by design - this only needs
// to turn "+3 in one update" into three visible steps, not recover from an unbounded catch-up.
const DEFAULT_STEP_INTERVAL_MS = 90

const createProgressBuffer = ({ stepIntervalMs = DEFAULT_STEP_INTERVAL_MS } = {}) => {
    let displayed = null
    let target = null
    let lastStepAt = 0

    // Feed the latest authoritative value on every update. Does not itself change what's
    // displayed - call read() to advance.
    const push = (value) => {
        if(typeof value !== 'number' || !Number.isFinite(value)) return
        if(displayed === null) {
            displayed = value
            target = value
            return
        }
        target = value
    }

    // Advances the displayed value towards target by at most one step per stepIntervalMs, and
    // returns whatever should be rendered right now.
    const read = (nowMs) => {
        if(displayed === null || displayed === target) return displayed
        if(nowMs - lastStepAt < stepIntervalMs) return displayed
        lastStepAt = nowMs
        displayed += displayed < target ? 1 : -1
        return displayed
    }

    // Call on a round/phase change so the buffer doesn't animate across an unrelated discontinuity
    // (e.g. a fresh round's progress starting back at 0 right after the previous round ended high).
    const reset = (value = null) => {
        displayed = value
        target = value
        lastStepAt = 0
    }

    return { push, read, reset }
}

export { createProgressBuffer }
