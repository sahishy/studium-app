import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import shineUrl from '../../../assets/images/shine.png'
import shine2Url from '../../../assets/images/shine2.png'
import ColorSwatch from './ColorSwatch'
import Title from '../../profile/components/Title'
import { describeTitle } from '../../profile/utils/titleUtils'
import { AVATAR_FACES } from '../../profile/utils/avatarUtils'
import { RARITY_SURFACE_INK, describeFace, formatColorName, getRarityStyle, getRaritySurface } from '../utils/rarityUtils'
import { RARITY_EFFECT_COLORS } from '../utils/crateInteraction'
import { getWindowRoot } from '../../../shared/utils/windowLayerUtils'

const VISIBLE_MS = 5200
const EXIT_MS = 400

const CrateRevealOverlay = ({ result, onExitStart, onClose }) => {

    const [animate, setAnimate] = useState(false)
    const exitingRef = useRef(false)
    const exitTimerRef = useRef(null)
    const overlayRef = useRef(null)
    const contentRef = useRef(null)
    const exitAnimationsRef = useRef([])
    useEffect(() => () => {
        window.clearTimeout(exitTimerRef.current)
        exitAnimationsRef.current.forEach((animation) => animation.cancel())
    }, [])

    const item = result?.color
    const isFace = item?.type === 'face'
    const isTitle = item?.type === 'title'
    const rarityStyle = getRarityStyle(item?.rarity)
    const rarityColor = RARITY_EFFECT_COLORS[item?.rarity] ?? RARITY_EFFECT_COLORS.Common
    const label = isTitle ? describeTitle(item.id).name : (isFace ? describeFace(item.value, item).name : formatColorName(item?.id ?? ''))

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            if(!exitingRef.current) setAnimate(true)
        }, 10)
        return () => window.clearTimeout(timeoutId)
    }, [])

    // Fades back out rather than cutting, so the exit reads as deliberate.
    const beginExit = useCallback(() => {

        if(exitingRef.current) return

        exitingRef.current = true
        // CSS shortens a reversed entrance transition. Explicit exits always get
        // the full crossfade, even when clicked during the initial reveal.
        for(const element of [overlayRef.current, contentRef.current]) {
            if(!element?.animate) continue
            const style = getComputedStyle(element)
            const from = { opacity: style.opacity }
            const to = { opacity: 0 }
            if(element === contentRef.current) {
                from.transform = style.transform
                to.transform = 'scale(0.9)'
            }
            exitAnimationsRef.current.push(element.animate([from, to], {
                duration: EXIT_MS, easing: 'ease-out', fill: 'forwards',
            }))
        }
        setAnimate(false)
        onExitStart?.()
        exitTimerRef.current = window.setTimeout(() => onClose?.(), EXIT_MS)

    }, [onClose, onExitStart])

    // The reward speaks for itself, so it bows out on its own.
    useEffect(() => {
        const timeoutId = window.setTimeout(beginExit, VISIBLE_MS)
        return () => window.clearTimeout(timeoutId)
    }, [beginExit])

    useEffect(() => {

        const onKeyDown = (event) => {
            if(event.key === 'Escape') beginExit()
        }

        document.addEventListener('keydown', onKeyDown)

        return () => document.removeEventListener('keydown', onKeyDown)

    }, [beginExit])

    const windowRoot = getWindowRoot()

    if(!windowRoot || !result) return null

    return createPortal(
        <div
            ref={overlayRef}
            data-testid='crate-reward-overlay'
            className={`fixed inset-0 z-[1200] flex items-center justify-center overflow-hidden bg-backdrop transition-all ease-out
                ${animate ? 'opacity-100 backdrop-blur-xs duration-250' : 'opacity-0 backdrop-blur-none duration-[400ms]'}`}
            onClick={beginExit}
        >
            <div
                data-testid='crate-reward-tint'
                aria-hidden='true'
                className='pointer-events-none absolute inset-0 opacity-[0.08]'
                style={{ backgroundColor: rarityColor }}
            />
            <div
                data-testid='crate-reward-rarity-shine'
                aria-hidden='true'
                className='pointer-events-none absolute w-[min(180vw,1100px)] aspect-square opacity-[0.10] [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center]'
                style={{ backgroundColor: rarityColor, maskImage: `url(${shine2Url})` }}
            />
            <img
                data-testid='crate-reward-shine'
                src={shineUrl}
                alt=''
                aria-hidden='true'
                className='animate-[spin_35s_linear_infinite] pointer-events-none absolute w-[min(160vw,760px)] max-w-none select-none opacity-[0.12]'
            />

            <div
                ref={contentRef}
                className={`relative flex flex-col items-center gap-6 p-8 transition-all ease-out
                    ${animate ? 'opacity-100 scale-100 duration-250' : 'opacity-0 scale-90 duration-[400ms]'}`}
            >
                {isTitle ? (
                    // A filled plate, not an outlined one: the border read as a stray white
                    // edge against the blurred backdrop, and a 10% tint let the backdrop show
                    // through where a card should be. The surface carries the rarity instead,
                    // and the ink is pinned because that surface stays light in both themes -
                    // a Common title's own text-neutral1 would vanish into it otherwise.
                    <div
                        className='relative flex size-36 items-center justify-center overflow-hidden rounded-xl p-3 shadow-xl shadow-shadow'
                        style={{ backgroundColor: getRaritySurface(item.rarity), '--rarity-ink': RARITY_SURFACE_INK }}
                    >
                        <Title
                            titleId={item.id}
                            size='md'
                            className='relative text-center leading-tight [&.text-neutral1]:text-[color:var(--rarity-ink)]'
                        />
                    </div>
                ) : isFace ? (
                    <div className='size-36 overflow-hidden rounded-3xl border border-neutral4 bg-white shadow-xl shadow-shadow'>
                        <img src={AVATAR_FACES[item.value]} alt={label} className='w-full h-full object-cover' />
                    </div>
                ) : (
                    <ColorSwatch color={item.value} className='size-36 shadow-xl shadow-shadow' />
                )}

                <div className='relative flex flex-col items-center gap-2'>

                    <h3 className='text-3xl font-semibold text-white [-webkit-text-stroke:2px_#1F2937] [paint-order:stroke_fill]'>{label}{result.duplicate && ' (Duplicate)'}</h3>

                    <span className='flex items-center gap-2 text-sm font-semibold bg-neutral0/40 rounded-lg px-3 py-1'>
                        <span className={`size-2 rounded-full ${rarityStyle.bar}`} />
                        <span className={`${rarityStyle.text} [-webkit-text-stroke:1px_#1F2937] [paint-order:stroke_fill]`}>{item.rarity}</span>
                    </span>

                </div>
            </div>
        </div>,
        windowRoot,
    )
}

export default CrateRevealOverlay
