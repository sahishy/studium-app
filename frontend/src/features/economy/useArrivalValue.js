import { useEffect, useRef, useState } from 'react'
import { useRewardFx } from './RewardFxContext'

// Shows a counter value that only climbs as reward icons land on it. While
// nothing is in flight it tracks the server value directly, so changes that did
// not come with an animation still show up straight away.
const useArrivalValue = (kind, serverValue, { startFrom = null, followServer = true } = {}) => {

    const { credits, inFlight } = useRewardFx()

    const [display, setDisplay] = useState(startFrom ?? serverValue ?? 0)
    const seenCreditsRef = useRef(credits?.[kind] ?? 0)

    const credited = credits?.[kind] ?? 0
    const pending = inFlight?.[kind] ?? 0

    useEffect(() => {

        const delta = credited - seenCreditsRef.current
        seenCreditsRef.current = credited

        if(delta > 0) {
            setDisplay((current) => current + delta)
        }

    }, [credited])

    useEffect(() => {

        if(!followServer || pending > 0 || serverValue == null) return

        setDisplay(serverValue)

    }, [followServer, pending, serverValue])

    return display
}

export default useArrivalValue
