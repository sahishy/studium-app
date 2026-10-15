import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import RewardFxLayer from './components/RewardFxLayer'

const EMPTY_TALLY = { xp: 0, lumen: 0, crates: 0 }

const RewardFxContext = createContext({
    celebrateReward: () => {},
    registerRewardTarget: () => () => {},
    pulses: EMPTY_TALLY,
    credits: EMPTY_TALLY,
    inFlight: EMPTY_TALLY,
})

const FLIGHT_DURATION_MS = 760
const FLIGHT_HOLD_MS = 320
const MAX_PARTICLES = 7

let nextFlightId = 0

// Never more icons than there are units to hand over, so a single crate is a
// single icon rather than a cluster that all credit the same thing.
const particleCountFor = (amount) => {
    const scaled = Math.ceil(Math.abs(Number(amount) || 0) / 5)
    return Math.max(1, Math.min(MAX_PARTICLES, Math.min(amount, Math.max(3, scaled))))
}

const RewardFxProvider = ({ children }) => {

    const targetsRef = useRef(new Map())
    const lastPointerRef = useRef(null)
    const [flights, setFlights] = useState([])
    const [pulses, setPulses] = useState(EMPTY_TALLY)
    const [credits, setCredits] = useState(EMPTY_TALLY)
    const [inFlight, setInFlight] = useState(EMPTY_TALLY)

    useEffect(() => {

        const onPointerDown = (event) => {
            lastPointerRef.current = { x: event.clientX, y: event.clientY }
        }

        window.addEventListener('pointerdown', onPointerDown)

        return () => window.removeEventListener('pointerdown', onPointerDown)

    }, [])

    const registerRewardTarget = useCallback((kind, element) => {

        if(!element) return () => {}

        targetsRef.current.set(kind, element)

        return () => {
            if(targetsRef.current.get(kind) === element) {
                targetsRef.current.delete(kind)
            }
        }

    }, [])

    // An icon landing is what credits the counter, so the number climbs in step
    // with the animation instead of jumping to the final total up front.
    const land = useCallback((kind, amount) => {
        setPulses((current) => ({ ...current, [kind]: (current[kind] ?? 0) + 1 }))
        setCredits((current) => ({ ...current, [kind]: (current[kind] ?? 0) + amount }))
        setInFlight((current) => ({ ...current, [kind]: Math.max(0, (current[kind] ?? 0) - amount) }))
    }, [])

    const celebrateReward = useCallback(({ xp = 0, lumen = 0, crates = 0, origin = null, scatter = false } = {}) => {

        const entries = [['xp', Number(xp) || 0], ['lumen', Number(lumen) || 0], ['crates', Number(crates) || 0]]
            .filter(([, amount]) => amount > 0)

        if(!entries.length) return

        const startPoint = origin ?? lastPointerRef.current ?? {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
        }

        // A counter that only exists while a reward is arriving (the crate slot)
        // may not have registered yet, so give it a few frames before giving up
        // on the animation and crediting the value outright.
        const withTarget = (kind, attempt, run) => {

            const target = targetsRef.current.get(kind)

            if(target) {
                run(target)
                return
            }

            if(attempt >= 5) {
                land(kind, entries.find(([entryKind]) => entryKind === kind)?.[1] ?? 0)
                return
            }

            requestAnimationFrame(() => withTarget(kind, attempt + 1, run))
        }

        entries.forEach(([kind, amount]) => withTarget(kind, 0, (target) => {

            const targetRect = target.getBoundingClientRect()
            const endPoint = {
                x: targetRect.left + (targetRect.width / 2),
                y: targetRect.top + (targetRect.height / 2),
            }

            const count = particleCountFor(amount)

            const spawnPoint = () => (scatter
                ? {
                    x: (window.innerWidth * 0.08) + (Math.random() * window.innerWidth * 0.84),
                    y: (window.innerHeight * 0.12) + (Math.random() * window.innerHeight * 0.76),
                }
                : {
                    x: startPoint.x + ((Math.random() - 0.5) * 240),
                    y: startPoint.y + ((Math.random() - 0.5) * 170),
                })

            // Split so the labels add up to what was actually granted.
            const base = Math.floor(amount / count)
            const remainder = amount % count

            const spawned = Array.from({ length: count }, (_, index) => ({
                id: nextFlightId += 1,
                kind,
                amount: base + (index < remainder ? 1 : 0),
                delayMs: index * (scatter ? 90 : 60),
                holdMs: FLIGHT_HOLD_MS,
                from: spawnPoint(),
                to: endPoint,
                durationMs: FLIGHT_DURATION_MS + (Math.random() * 180),
            }))

            setInFlight((current) => ({ ...current, [kind]: (current[kind] ?? 0) + amount }))
            setFlights((current) => [...current, ...spawned])

            spawned.forEach((flight) => {
                window.setTimeout(() => {
                    land(kind, flight.amount)
                    setFlights((current) => current.filter((item) => item.id !== flight.id))
                }, flight.delayMs + flight.holdMs + flight.durationMs)
            })

        }))

    }, [land])

    const value = useMemo(() => ({
        celebrateReward,
        registerRewardTarget,
        pulses,
        credits,
        inFlight,
    }), [celebrateReward, credits, inFlight, pulses, registerRewardTarget])

    return (
        <RewardFxContext.Provider value={value}>
            {children}
            <RewardFxLayer flights={flights} />
        </RewardFxContext.Provider>
    )
}

const useRewardFx = () => useContext(RewardFxContext)

export { RewardFxProvider, useRewardFx }
