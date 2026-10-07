import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import CrateBox from './CrateBox'
import CrateRevealOverlay from './CrateRevealOverlay'
import { getCrateOpeningOffset } from '../utils/crateLayout'
import CrateInteractionOverlay from './CrateInteractionOverlay'
import useScreenShake from '../../../shared/utils/useScreenShake'

// The crate never changes its place in the layout. Opening it just transforms
// it toward the middle of the Locker, which is the only way the move can
// actually animate.
const CrateView = ({ crate, lockerRef }) => {

    const { phase, rarity, rarityTransition, motion, reducedMotion, markReady, isFlashing, isRevealed, showReward, result, beginDismiss, dismiss } = crate

    const anchorRef = useRef(null)
    const stageRef = useRef(null)
    const [offset, setOffset] = useState({ x: 0, y: 0 })

    const isClosing = phase === 'closing'
    const isIdle = phase === 'ready' || isClosing
    useLayoutEffect(() => {
        if(!isClosing || !stageRef.current?.animate) return
        // A very early close may interrupt the crate's outgoing fade too.
        // Reset its pose while hidden, then give the returning idle a full fade.
        const animation = stageRef.current.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 250, easing: 'ease-out', fill: 'both',
        })
        return () => animation.cancel()
    }, [isClosing])
    const { screenShakeRef, shake } = useScreenShake()
    useEffect(() => {
        screenShakeRef.current = lockerRef?.current
        return () => { screenShakeRef.current = null }
    }, [lockerRef, screenShakeRef])
    const onTap = () => {
        if(crate.tap()) shake('impact')
    }

    useLayoutEffect(() => {

        if(isIdle) {
            setOffset({ x: 0, y: 0 })
            return
        }

        const anchor = anchorRef.current
        const locker = lockerRef?.current

        if(!anchor || !locker) return

        // The anchor itself is never transformed, so measuring it stays stable
        // however many times the crate opens.
        const updateOffset = () => setOffset(getCrateOpeningOffset(
            anchor.getBoundingClientRect(), locker.getBoundingClientRect(),
        ))
        updateOffset()
        const observer = new ResizeObserver(updateOffset)
        observer.observe(anchor)
        observer.observe(locker)
        window.addEventListener('resize', updateOffset)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', updateOffset)
        }

    }, [isIdle, lockerRef])

    const scale = isIdle ? 1 : 1.25

    return (
        <>
            {phase !== 'ready' && lockerRef?.current ? (
                <CrateInteractionOverlay crate={crate} container={lockerRef.current} onTap={onTap} />
            ) : null}
            <div
                ref={anchorRef}
                data-testid='crate-anchor'
                className={`relative flex-1 w-full flex items-center justify-center pointer-events-none
                    ${isIdle ? 'z-2' : 'z-[1100]'}`}
            >
                <div
                    ref={stageRef}
                    data-testid='crate-stage'
                    className={`w-full h-[min(54vh,480px)] ease-out
                        ${isClosing
                            ? 'opacity-100 transition-opacity duration-250'
                            : isIdle
                            ? 'opacity-100 transition-none'
                            : isFlashing || isRevealed
                                ? 'opacity-0 transition-opacity duration-180'
                                : 'opacity-100 transition-all duration-500'}`}
                    style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
                >
                    <CrateBox
                        className='h-full w-full'
                        interactive={!isIdle && phase !== 'requesting'}
                        rarity={rarity}
                        rarityTransition={isIdle ? null : rarityTransition}
                        motion={isIdle ? null : motion}
                        reducedMotion={reducedMotion}
                        onReady={markReady}
                    />
                </div>
            </div>

            {showReward && result ? (
                <CrateRevealOverlay result={result} onExitStart={beginDismiss} onClose={dismiss} />
            ) : null}
        </>
    )
}

export default CrateView
