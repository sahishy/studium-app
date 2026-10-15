import { useEffect, useRef, useState } from 'react'
import { useRewardFx } from '../RewardFxContext'

const RewardCounter = ({ kind, className = '', children }) => {

    const { registerRewardTarget, pulses } = useRewardFx()
    const elementRef = useRef(null)
    const pulse = pulses?.[kind] ?? 0

    // The pulse tally outlives this component, so a freshly mounted counter
    // adopts whatever it already was. Only a change from here on is a reward
    // this counter actually witnessed.
    const seenPulseRef = useRef(pulse)
    const [armed, setArmed] = useState(false)

    useEffect(() => registerRewardTarget(kind, elementRef.current), [kind, registerRewardTarget])

    useEffect(() => {

        const element = elementRef.current

        if(!element || pulse === seenPulseRef.current) return

        seenPulseRef.current = pulse

        if(!armed) {
            setArmed(true)
            return
        }

        // Restarting the animation needs the name cleared and the layout flushed,
        // otherwise rapid hits are swallowed by the still-running one.
        element.style.animation = 'none'
        void element.offsetWidth
        element.style.animation = ''

    }, [armed, pulse])

    return (
        <div
            ref={elementRef}
            className={`${armed ? 'animate-punch-scale' : ''} ${className}`}
        >
            {children}
        </div>
    )
}

export default RewardCounter
