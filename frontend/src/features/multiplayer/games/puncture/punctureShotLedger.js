import { predictShot, STUN_MS } from './puncturePrediction.js'

const shotKey = (shot) => {
    if(shot?.clientActionId) return `client:${shot.clientActionId}`
    if(Number.isFinite(Number(shot?.sequence))) return `server:${shot.roundIndex ?? 0}:${shot.sequence}`
    return null
}

const appendPendingShot = (ledger, shot, createdAt = Date.now()) => {
    const key = shotKey(shot)
    if(!key || ledger.some((entry) => shotKey(entry.shot) === key)) return ledger
    return [...ledger, { id: shot.clientActionId, status: 'pending', createdAt, shot }]
}

const reconcileActionResult = (ledger, result) => {
    if(result?.action !== 'game.shoot' || !result?.clientActionId) return ledger
    const index = ledger.findIndex((entry) => entry.id === result.clientActionId)
    if(index < 0) return ledger
    if(!result.accepted) return ledger.filter((_, entryIndex) => entryIndex !== index)
    if(!result.shot) return ledger
    return ledger.map((entry, entryIndex) => entryIndex === index
        ? { ...entry, status: 'accepted', shot: { ...result.shot, clientActionId: result.clientActionId } }
        : entry)
}

const pruneConfirmedShots = (ledger, recentShots = []) => {
    const confirmedIds = new Set(recentShots.map((shot) => shot?.clientActionId).filter(Boolean))
    return ledger.filter((entry) => !confirmedIds.has(entry.id))
}

const mergeShotEvents = (...groups) => {
    const byKey = new Map()
    groups.flat().forEach((shot) => {
        const key = shotKey(shot)
        if(key) byKey.set(key, shot)
    })
    return [...byKey.values()].sort((first, second) => {
        const shotTimeDifference = Number(first?.shotAt) - Number(second?.shotAt)
        if(Number.isFinite(shotTimeDifference) && shotTimeDifference !== 0) return shotTimeDifference
        return (Number(first?.sequence) || Number.MAX_SAFE_INTEGER) - (Number(second?.sequence) || Number.MAX_SAFE_INTEGER)
    })
}

const getUnconfirmedShots = (ledger, recentShots = []) => {
    const confirmedIds = new Set(recentShots.map((shot) => shot?.clientActionId).filter(Boolean))
    return ledger.filter((entry) => !confirmedIds.has(entry.id)).map((entry) => entry.shot)
}

const applyShotOverlay = (player, shots = []) => {
    if(!player || !shots.length) return player
    const state = player.state ?? {}
    const misses = shots.filter((shot) => !shot.hit && Number.isFinite(Number(shot.attachedAngle)))
    const predictedStunnedUntil = shots
        .filter((shot) => shot.hit)
        .reduce((latest, shot) => Math.max(latest, Number(shot.shotAt) + STUN_MS), 0)
    return {
        ...player,
        state: {
            ...state,
            pinsRemaining: Math.max(0, (Number(state.pinsRemaining) || 0) - misses.length),
            puncturePinAngles: [
                ...(state.puncturePinAngles ?? []),
                ...misses.map((shot) => Number(shot.attachedAngle)),
            ],
            stunnedUntil: Math.max(Number(state.stunnedUntil) || 0, predictedStunnedUntil),
        },
    }
}

const predictionAngles = (authoritativeAngles = [], shots = []) => [
    ...authoritativeAngles,
    ...shots.filter((shot) => !shot.hit).map((shot) => Number(shot.attachedAngle)),
]

const recalculatePendingShots = (ledger, inputs) => {
    if(!inputs) return ledger
    const attachedPinAngles = [...(inputs.attachedPinAngles ?? [])]
    return ledger.map((entry) => {
        let nextEntry = entry
        if(entry.status !== 'accepted') {
            const prediction = predictShot({
                shotAt: entry.shot.shotAt,
                roundStartedAt: inputs.roundStartedAt,
                rotationTurnsPerSecond: inputs.rotationTurnsPerSecond,
                generatedPinAngles: inputs.generatedPinAngles,
                attachedPinAngles,
            })
            const predictionChanged = entry.shot.impactAt !== prediction.shotImpactAt
                || entry.shot.hit !== prediction.hit
                || entry.shot.attachedAngle !== prediction.attachedAngle
                || entry.shot.targetAngle !== prediction.targetAngle
            if(predictionChanged) {
                nextEntry = {
                    ...entry,
                    shot: {
                        ...entry.shot,
                        impactAt: prediction.shotImpactAt,
                        hit: prediction.hit,
                        attachedAngle: prediction.attachedAngle,
                        targetAngle: prediction.targetAngle,
                    },
                }
            }
        }
        if(!nextEntry.shot.hit && Number.isFinite(Number(nextEntry.shot.attachedAngle))) {
            attachedPinAngles.push(Number(nextEntry.shot.attachedAngle))
        }
        return nextEntry
    })
}

const getPlaybackView = ({ pinsRemaining = 0, attachedPinAngles = [], queuedShots = [], activeShot = null }) => {
    const queuedMisses = queuedShots.filter((shot) => !shot.hit).length
    const activeIsHit = Boolean(activeShot?.hit)
    const activeIsMiss = Boolean(activeShot && !activeShot.hit)
    const displayPinsRemaining = Math.max(0, Number(pinsRemaining) + queuedMisses - (activeIsHit ? 1 : 0))
    const hiddenAttachedPins = queuedMisses + (activeIsMiss ? 1 : 0)
    return {
        displayPinsRemaining,
        visibleAttachedPinAngles: hiddenAttachedPins > 0
            ? attachedPinAngles.slice(0, Math.max(0, attachedPinAngles.length - hiddenAttachedPins))
            : attachedPinAngles,
    }
}

export {
    appendPendingShot,
    applyShotOverlay,
    getUnconfirmedShots,
    getPlaybackView,
    mergeShotEvents,
    predictionAngles,
    pruneConfirmedShots,
    recalculatePendingShots,
    reconcileActionResult,
    shotKey,
}
