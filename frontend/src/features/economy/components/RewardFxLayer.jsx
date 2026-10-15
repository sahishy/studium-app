import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PiStarFourFill } from 'react-icons/pi'
import { FaBoxOpen } from 'react-icons/fa6'
import LumenIcon from './LumenIcon'

const RewardFlight = ({ flight }) => {

    const [arrived, setArrived] = useState(false)

    useEffect(() => {
        // The icon appears and sits still for a beat before it is drawn in.
        const timeoutId = window.setTimeout(() => setArrived(true), flight.delayMs + flight.holdMs)

        return () => window.clearTimeout(timeoutId)
    }, [flight.delayMs, flight.holdMs])

    const position = arrived ? flight.to : flight.from

    return (
        <div
            className='absolute'
            style={{
                left: 0,
                top: 0,
                transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%) scale(${arrived ? 0.55 : 1})`,
                opacity: arrived ? 0 : 1,
                // Eases in rather than out: the icon creeps away from where it
                // appeared and is moving fastest as it reaches the counter. The
                // fade holds off until late in the flight so the icon stays
                // readable for most of the way across.
                transition: `transform ${flight.durationMs}ms cubic-bezier(0.55, 0, 0.9, 0.35), opacity ${Math.round(flight.durationMs * 0.34)}ms ease-in ${Math.round(flight.durationMs * 0.66)}ms`,
                willChange: 'transform, opacity',
            }}
        >
            <span className={`flex items-center gap-1 text-sm font-bold
                ${flight.kind === 'lumen' ? 'text-sky-500' : flight.kind === 'crates' ? 'text-neutral1' : 'text-yellow-400'}`}
            >
                +{flight.amount}
                {flight.kind === 'lumen' ? (
                    <LumenIcon className='size-5' />
                ) : flight.kind === 'crates' ? (
                    <FaBoxOpen className='size-4' />
                ) : (
                    <PiStarFourFill className='size-4' />
                )}
            </span>
        </div>
    )
}

const RewardFxLayer = ({ flights = [] }) => {

    if(typeof document === 'undefined' || !flights.length) {
        return null
    }

    return createPortal(
        // Above tooltips (z-9999) and toasts: the flown icons read as coming from whatever
        // surface granted them, so nothing should ever cover them mid-flight.
        <div className='fixed inset-0 z-[10000] pointer-events-none overflow-hidden'>
            {flights.map((flight) => (
                <RewardFlight key={flight.id} flight={flight} />
            ))}
        </div>,
        document.body,
    )
}

export default RewardFxLayer
