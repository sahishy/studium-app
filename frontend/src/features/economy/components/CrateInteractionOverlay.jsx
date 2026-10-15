import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BsHandIndexThumbFill } from 'react-icons/bs'
import { FaRegCircle } from 'react-icons/fa'
import shine2Url from '../../../assets/images/shine2.png'
import shine3Url from '../../../assets/images/shine3.png'
import shineUrl from '../../../assets/images/shine4.png'
import { CRATE_CHANCES, CRATE_RARITY_SHINES, RARITY_EFFECT_COLORS, getCrateProgressDots } from '../utils/crateInteraction'
import { RARITY_ORDER } from '../utils/rarityUtils'
import { getWindowRoot } from '../../../shared/utils/windowLayerUtils'

// Timed motion stays alongside its inline Tailwind layout; no component stylesheet.
const SPIN_FRAMES = [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }]
const SPIN_OPTIONS = { duration: 28000, iterations: Infinity }
const ENTER_FRAMES = [{ opacity: 0 }, { opacity: 1 }]
const ENTER_OPTIONS = { duration: 180, easing: 'ease-out' }
const RING_FRAMES = [
    { opacity: 0.75, transform: 'scale(0.6)', offset: 0 },
    { opacity: 0, transform: 'scale(1.45)', offset: 0.65 },
    { opacity: 0, transform: 'scale(1.45)', offset: 1 },
]
const RING_OPTIONS = { duration: 1100, iterations: Infinity, easing: 'ease-out' }
const STAR_FRAMES = [
    { opacity: 0, transform: 'rotate(-80deg) scale(0.1)', offset: 0 },
    { opacity: 0.38, transform: 'rotate(-15deg) scale(1.35)', offset: 0.18 },
    { opacity: 0.3, transform: 'rotate(90deg) scale(1.1)', offset: 0.62 },
    { opacity: 0, transform: 'rotate(240deg) scale(0.15)', offset: 1 },
]
const STAR_OPTIONS = { duration: 1400, easing: 'ease-out', fill: 'forwards' }
const FLASH_FRAMES = [{ opacity: 0, offset: 0 }, { opacity: 0.55, offset: 0.16 }, { opacity: 0, offset: 1 }]
const FLASH_OPTIONS = { duration: 320, easing: 'ease-out', fill: 'forwards' }
const PULSE_OPTIONS = { duration: 3200, iterations: Infinity, easing: 'ease-in-out' }

const useElementMotion = (ref, frames, options, enabled = true) => {
    useEffect(() => {
        if(!enabled || !ref.current?.animate) return
        const animation = ref.current.animate(frames, options)
        return () => animation.cancel()
    }, [ref, frames, options, enabled])
}

const UpgradeShine = ({ color }) => {
    const ref = useRef(null)
    useElementMotion(ref, STAR_FRAMES, STAR_OPTIONS)
    return <div ref={ref} data-testid='crate-upgrade-shine' aria-hidden='true'
        className='pointer-events-none absolute z-[1060] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[clamp(180px,32vw,380px)] aspect-square opacity-0 [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center]'
        style={{ backgroundColor: color, maskImage: `url(${shine3Url})` }} />
}

const RarityFlash = ({ color }) => {
    const ref = useRef(null)
    useElementMotion(ref, FLASH_FRAMES, FLASH_OPTIONS)
    return <div ref={ref} data-testid='crate-flash' aria-hidden='true'
        className='pointer-events-none fixed inset-0 z-[1250] opacity-0' style={{ backgroundColor: color }} />
}

const CrateInteractionOverlay = ({ crate, container, onTap }) => {
    const { phase, rarity, upgradeId, chancesUsed, canTap } = crate
    const finale = ['bursting', 'flashing', 'revealed', 'closing'].includes(phase)
    const fadeShine = ['bursting', 'flashing', 'revealed', 'closing'].includes(phase)
    const button = useRef(null)
    const rays = useRef(null)
    const rarityShine = useRef(null)
    const vignette = useRef(null)
    const ring = useRef(null)
    const guide = useRef(null)
    useEffect(() => {
        if(canTap) button.current?.focus({ preventScroll: true })
    }, [canTap])
    const tier = Math.max(0, RARITY_ORDER.indexOf(rarity))
    const opacity = 0.48 + tier * 0.04
    const edgeWidth = 7 + tier * 1.5
    const pulseFrames = useMemo(() => [{ opacity: opacity * 0.7 }, { opacity, offset: 0.5 }, { opacity: opacity * 0.7 }], [opacity])
    useElementMotion(rays, SPIN_FRAMES, SPIN_OPTIONS)
    useElementMotion(rarityShine, SPIN_FRAMES, SPIN_OPTIONS)
    useElementMotion(vignette, pulseFrames, PULSE_OPTIONS)
    useElementMotion(ring, RING_FRAMES, RING_OPTIONS, canTap)
    useElementMotion(guide, ENTER_FRAMES, ENTER_OPTIONS, !finale && phase !== 'requesting')
    const remaining = CRATE_CHANCES - chancesUsed
    const color = RARITY_EFFECT_COLORS[rarity]
    const shine = CRATE_RARITY_SHINES[rarity]
    const screenRoot = getWindowRoot() ?? document.body
    return <>
        {createPortal(<>
            <div className='pointer-events-none absolute inset-0 z-[1050] overflow-hidden'>
                <div ref={rarityShine} data-testid='crate-rarity-shine' aria-hidden='true'
                    className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 aspect-square transition-[width,opacity,background-color] ${fadeShine ? 'duration-200' : 'duration-[320ms]'} [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center]`}
                    style={{ width: `min(150vw, ${shine?.size ?? 840}px)`, opacity: fadeShine ? 0 : shine?.opacity ?? 0, backgroundColor: color, maskImage: `url(${shineUrl})` }} />
                <div ref={rays} aria-hidden='true'
                    className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(110vw,760px)] aspect-square opacity-10 transition-colors duration-[320ms] [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center] [mask-composite:intersect]'
                    style={{ backgroundColor: color, maskImage: `url(${shine2Url}), radial-gradient(circle, #000 15%, transparent 64%)` }} />
                <button ref={button} aria-label='Open crate'
                    className='pointer-events-auto absolute inset-0 size-full cursor-pointer disabled:cursor-pointer touch-manipulation border-0 bg-transparent focus-visible:outline-2 focus-visible:-outline-offset-6 focus-visible:outline-gray-300'
                    disabled={!canTap} onClick={onTap} />
            </div>
            <div ref={guide} data-testid='crate-guide'
                className={`pointer-events-none absolute inset-x-0 bottom-[10%] z-[1115] flex flex-col items-center gap-3.5 text-neutral3 transition-opacity duration-150 ${finale || phase === 'requesting' ? 'opacity-0' : 'opacity-100'}`}
                aria-hidden={finale || phase === 'requesting'}>
                <div className='relative h-[49px] w-[42px] -rotate-[18deg]' role='img' aria-label='Tap to open the crate'>
                    <BsHandIndexThumbFill className='absolute size-8 bottom-0 left-1.5 animate-bounce' aria-hidden='true' />
                    <FaRegCircle ref={ring} data-testid='crate-tap-ring' className='absolute size-[19px] left-2.5 top-0' aria-hidden='true' />
                </div>
                {chancesUsed === CRATE_CHANCES ? <span data-testid='crate-open-prompt' className='text-xs font-medium text-neutral1'>Tap to open!</span> : <div className='flex gap-[9px]' role='img' aria-label={`${remaining} ${remaining === 1 ? 'tap' : 'taps'} remaining`}>
                    {getCrateProgressDots(chancesUsed).map((used, index) => <span key={index} data-testid='crate-progress-dot' data-used={used}
                        className={`size-[7px] rounded-full transition-[background-color,opacity] duration-150 ${used ? 'bg-gray-300 opacity-50' : 'bg-gray-500'}`} />)}
                </div>}
            </div>
            {upgradeId > 0 && !finale && <UpgradeShine key={upgradeId} color={color} />}
        </>, container)}
        {/* Outside the Locker's shaking transform, covering the sidebar too. */}
        {createPortal(<>
            <div aria-hidden='true'
                className={`pointer-events-none fixed inset-0 transition-opacity duration-[400ms] ${crate.showReward ? 'z-[1210]' : 'z-[1190]'} ${phase === 'closing' ? 'opacity-0' : 'opacity-100'}`}>
            <div ref={vignette} data-testid='crate-vignette' aria-hidden='true'
                className='pointer-events-none absolute inset-0 transition-[background-color,opacity] duration-[320ms]'
                style={{ backgroundColor: color, opacity, maskImage: `linear-gradient(to right, #000, transparent ${edgeWidth}%, transparent ${100 - edgeWidth}%, #000), linear-gradient(to bottom, #000, transparent ${edgeWidth}%, transparent ${100 - edgeWidth}%, #000)` }} />
            </div>
            {phase === 'flashing' && <RarityFlash color={color} />}
        </>, screenRoot)}
    </>
}
export default CrateInteractionOverlay
