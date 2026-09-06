// Mirrors the server's authoritative hit-detection formula exactly (backend/realtime/src/games/
// games/puncture.ts - SHOT_WORLD_ANGLE/SHOT_TRAVEL_MS/STUN_MS/PUNCTURE_COLLISION_DEGREES and the
// normalizeAngle/angularDistance helpers, plus the `game.shoot` branch of handleAction) so a local
// shot can be predicted immediately instead of waiting a full round trip. The server remains
// authoritative - this is reconciled away as soon as its ack/delta arrives.
// Kept honest by backend/realtime/src/games/puncture-prediction-parity.test.js, which imports both
// this file and the server engine and asserts they agree across a matrix of inputs.
export const SHOT_WORLD_ANGLE = 90
export const SHOT_TRAVEL_MS = 75
export const STUN_MS = 2_000
export const PUNCTURE_COLLISION_DEGREES = 7

export const normalizeAngle = (angle) => ((angle % 360) + 360) % 360

export const angularDistance = (first, second) => {
    const distance = Math.abs(normalizeAngle(first) - normalizeAngle(second))
    return Math.min(distance, 360 - distance)
}

/**
 * @param {number} shotAt - the local synced-clock time the shot was fired (pre-travel).
 * @param {number} roundStartedAt - server's punctureRoundStartedAt.
 * @param {number} rotationTurnsPerSecond
 * @param {number[]} generatedPinAngles - the round's fixed obstacle pins.
 * @param {number[]} attachedPinAngles - this player's own previously-attached pins.
 */
export const predictShot = ({ shotAt, roundStartedAt, rotationTurnsPerSecond, generatedPinAngles = [], attachedPinAngles = [] }) => {
    const shotImpactAt = shotAt + SHOT_TRAVEL_MS
    const elapsedMs = Math.max(0, shotImpactAt - Number(roundStartedAt))
    const rotationDegrees = Number(rotationTurnsPerSecond) * 360 * (elapsedMs / 1000)
    const attachedAngle = normalizeAngle(SHOT_WORLD_ANGLE - rotationDegrees)
    const existingAngles = [...generatedPinAngles, ...attachedPinAngles]
    const collidedAngle = existingAngles.find((angle) => angularDistance(Number(angle), attachedAngle) <= PUNCTURE_COLLISION_DEGREES)
    const hit = collidedAngle != null
    return {
        shotImpactAt,
        attachedAngle: hit ? null : attachedAngle,
        targetAngle: hit ? Number(collidedAngle) : attachedAngle,
        hit,
    }
}
