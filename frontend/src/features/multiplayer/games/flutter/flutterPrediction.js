// Mirrors the server's authoritative flight integrator exactly (backend/realtime/src/games/
// flutter.ts - integrateFlutterMotion, FLUTTER_MAX_SPEED/FLIGHT_ACCELERATION/FLUTTER_BOUNDS), so
// the client can reproduce the server's own view of where each avatar is instead of treating a
// timestamped past position as the present one. Kept honest by
// backend/realtime/src/games/flutter-prediction-parity.test.js, which imports both this file and
// the server engine and asserts they agree step for step.
export const FLUTTER_MAX_SPEED = 6.4
export const FLIGHT_ACCELERATION = 10
export const FLUTTER_BOUNDS = { x: 5.2, y: 3.15 }
export const FLUTTER_AVATAR_RADIUS = 0.4
export const FLUTTER_RING_INNER_RADIUS = 2.05

export const EMPTY_FLUTTER_INPUT = { up: false, down: false, left: false, right: false }

/**
 * Fixed 1/60s substeps, velocity zeroed on contact with a bound - both deliberate, both matching
 * the server. Integrating with a raw frame delta instead (what the scene used to do) diverges
 * under variable frame rate, and skipping the velocity reset lets the client fly back off a wall
 * instantly while the server is still at a standstill.
 */
export const integrateFlutterMotion = (state, elapsedMs) => {
    let remaining = Math.max(0, Number(elapsedMs) || 0) / 1000
    let x = Number(state.x) || 0
    let y = Number(state.y) || 0
    let velocityX = Number(state.velocityX) || 0
    let velocityY = Number(state.velocityY) || 0
    const input = state.input ?? EMPTY_FLUTTER_INPUT
    const horizontal = Number(Boolean(input.right)) - Number(Boolean(input.left))
    const vertical = Number(Boolean(input.up)) - Number(Boolean(input.down))
    const magnitude = Math.hypot(horizontal, vertical) || 1
    const targetX = (horizontal / magnitude) * FLUTTER_MAX_SPEED
    const targetY = (vertical / magnitude) * FLUTTER_MAX_SPEED

    while(remaining > 0) {
        const step = Math.min(1 / 60, remaining)
        const blend = 1 - Math.exp(-FLIGHT_ACCELERATION * step)
        velocityX += (targetX - velocityX) * blend
        velocityY += (targetY - velocityY) * blend
        x += velocityX * step
        y += velocityY * step
        if(x <= -FLUTTER_BOUNDS.x || x >= FLUTTER_BOUNDS.x) velocityX = 0
        if(y <= -FLUTTER_BOUNDS.y || y >= FLUTTER_BOUNDS.y) velocityY = 0
        x = Math.max(-FLUTTER_BOUNDS.x, Math.min(FLUTTER_BOUNDS.x, x))
        y = Math.max(-FLUTTER_BOUNDS.y, Math.min(FLUTTER_BOUNDS.y, y))
        remaining -= step
    }

    return { x, y, velocityX, velocityY }
}

/**
 * Where the server believes an avatar is *now*, given the timestamped state it last published.
 *
 * The server only rewrites flutterX/flutterY when it processes an input or resolves a ring, so a
 * published position is a snapshot at `from` (the player's flutterLastUpdatedAt), not a current
 * one - between those moments the server is implicitly carrying the avatar forward under the last
 * input it accepted, and so must the client. Local inputs the server has not acknowledged yet are
 * replayed on top in order, which is what makes the local avatar respond instantly while still
 * converging on the server's answer rather than fighting it.
 *
 * @param {{x, y, velocityX, velocityY, input}} anchor - authoritative state as published.
 * @param {number} from - server clock time that anchor describes (flutterLastUpdatedAt).
 * @param {number} to - server clock time to advance to (the synced clock's now).
 * @param {Array<{at: number, input: object}>} pendingInputs - unacknowledged local inputs, in
 *   send order, timestamped on the same synced clock.
 */
export const extrapolateFlutterState = (anchor, from, to, pendingInputs = []) => {
    let state = {
        x: Number(anchor?.x) || 0,
        y: Number(anchor?.y) || 0,
        velocityX: Number(anchor?.velocityX) || 0,
        velocityY: Number(anchor?.velocityY) || 0,
        input: anchor?.input ?? EMPTY_FLUTTER_INPUT,
    }
    const target = Number(to)
    let cursor = Number.isFinite(Number(from)) ? Number(from) : target
    if(!Number.isFinite(target)) return state

    for(const entry of pendingInputs) {
        const at = Math.min(Number(entry?.at), target)
        if(!Number.isFinite(at)) continue
        if(at > cursor) {
            state = { ...integrateFlutterMotion(state, at - cursor), input: entry?.input ?? state.input }
            cursor = at
        } else {
            state = { ...state, input: entry?.input ?? state.input }
        }
    }

    if(target > cursor) state = { ...integrateFlutterMotion(state, target - cursor), input: state.input }
    return state
}

/** The server's ring test, for parity - see clearsRing in backend/realtime/src/games/flutter.ts. */
export const clearsFlutterRing = ({ x, y }, center) => (
    Math.hypot(Number(x) - Number(center?.x ?? 0), Number(y) - Number(center?.y ?? 0)) + FLUTTER_AVATAR_RADIUS <= FLUTTER_RING_INNER_RADIUS
)
