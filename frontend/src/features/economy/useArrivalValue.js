import { useLayoutEffect, useRef, useState } from 'react'
import { useRewardFx } from './RewardFxContext'
import { createArrivalState, nextArrivalState } from './utils/arrivalValue'

// Shows a counter value that only climbs as reward icons land on it. While
// nothing is in flight it tracks the server value directly, so changes that did
// not come with an animation still show up straight away. See
// utils/arrivalValue.js for how the two are reconciled.
const useArrivalValue = (kind, serverValue, { startFrom = null, followServer = true } = {}) => {

    const { credits, inFlight } = useRewardFx()

    const credited = credits?.[kind] ?? 0
    const pending = inFlight?.[kind] ?? 0

    const [display, setDisplay] = useState(startFrom ?? serverValue ?? 0)
    const stateRef = useRef(null)

    if(!stateRef.current) {
        stateRef.current = createArrivalState({ display, credited, serverValue })
    }

    useLayoutEffect(() => {

        stateRef.current = nextArrivalState(stateRef.current, { serverValue, pending, credited, followServer })
        setDisplay(stateRef.current.display)

    }, [credited, followServer, pending, serverValue])

    return display
}

export default useArrivalValue
