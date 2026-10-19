import { shotKey } from './punctureShotLedger.js'

export const flightProgress = (shot, now) => Math.max(0, Math.min(1,
    (now - Number(shot.shotAt)) / Math.max(1, Number(shot.impactAt) - Number(shot.shotAt))))

export const reconcileFlights = (current, shots, seen, now) => {
    const byKey = new Map(shots.map((shot) => [shotKey(shot), shot]).filter(([key]) => key))
    const flights = current.filter(({ key }) => byKey.has(key)).map(({ key }) => ({ key, shot: byKey.get(key) }))
    for(const [key, shot] of byKey) {
        if(!seen.has(key) && Number(shot.impactAt) > now) flights.push({ key, shot })
        seen.add(key)
    }
    while(seen.size > 256) seen.delete(seen.values().next().value)
    return flights.filter(({ shot }) => Number(shot.impactAt) > now)
}

export const visibleFlightPins = (angles, flights) => {
    const hidden = flights.filter(({ shot }) => !shot.hit).map(({ shot }) => Number(shot.attachedAngle))
    return angles.filter((angle) => {
        const index = hidden.findIndex((candidate) => Math.abs(candidate - Number(angle)) < .00001)
        if(index < 0) return true
        hidden.splice(index, 1)
        return false
    })
}
