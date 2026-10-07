import { useCallback, useEffect, useRef, useState } from 'react'
import { FaBoxOpen, FaFlagCheckered } from 'react-icons/fa6'
import AvatarModel from '../../../shared/components/avatar/AvatarModel'
import RadialProgress from '../../../shared/components/ui/RadialProgress'
import LumenIcon from '../../economy/components/LumenIcon'
import { useEconomy } from '../../economy/EconomyContext'
import { useRewardFx } from '../../economy/RewardFxContext'
import { getXpToNextLevel } from '../../profile/utils/xpUtils'
import { buildRoadmap } from '../utils/roadmapUtils'

// Nodes are placed by level number against a fixed-height path, so neither
// sliding the window nor gaining a level ever shifts the content. Without that,
// the view had to be yanked to compensate and the character teleported with it.
const MAX_PATH_LEVEL = 300
const NODE_SPACING = 128
const PATH_PADDING = 150
const CHARACTER_OFFSET = 100
const IDLE_RETURN_MS = 2000
const CAMERA_DURATION_MS = 900

const easeInOutCubic = (progress) => (progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - (Math.pow((-2 * progress) + 2, 3) / 2))

const RoadmapDot = ({ node, onClaim, claiming }) => {

    const isClaimable = node.state === 'claimable'
    const isClaimed = node.state === 'claimed'
    const isCrate = node.reward === 'crate'
    const isStart = node.reward === 'start'

    const size = isCrate ? 'size-16' : 'size-11'

    return (
        <>
            {isClaimable ? (
                <span className={`absolute ${size} rounded-full border-2 border-sky-400 motion-safe:animate-ping opacity-60`} />
            ) : null}

            <button
                type='button'
                disabled={!isClaimable || claiming}
                onClick={() => onClaim(node.level)}
                title={isStart ? 'Where it begins' : isCrate ? 'Crate' : 'Lumen'}
                className={`relative ${size} rounded-full flex items-center justify-center transition-all
                    ${isClaimable
                        ? 'bg-sky-500 text-white cursor-pointer hover:scale-105'
                        : isClaimed
                            ? 'bg-sky-400/25 text-sky-500/70 cursor-default'
                            : 'bg-neutral5 text-neutral2 cursor-default'}`}
            >
                {isStart ? (
                    <FaFlagCheckered className='text-base' />
                ) : isCrate ? (
                    <FaBoxOpen className='text-xl' />
                ) : (
                    <LumenIcon className={`size-5 ${isClaimable ? 'brightness-0 invert' : isClaimed ? 'opacity-70' : 'opacity-30 grayscale'}`} />
                )}
            </button>
        </>
    )
}

const LevelRoadmap = ({ level = 1, xp = 0, profile }) => {

    const { snapshot, claimLevel } = useEconomy()
    const { celebrateReward } = useRewardFx()

    const [claiming, setClaiming] = useState(false)
    const [error, setError] = useState('')

    const scrollRef = useRef(null)
    const lastInteractionRef = useRef(0)
    const hasAnchoredRef = useRef(false)
    const frameRef = useRef(null)
    const tweenRef = useRef(null)

    const nodes = buildRoadmap({ level, claimedLevels: snapshot?.wallet?.claimedLevels })
    const xpNeeded = getXpToNextLevel(level)

    const contentHeight = ((MAX_PATH_LEVEL - 1) * NODE_SPACING) + (PATH_PADDING * 2)

    const currentNode = nodes.find((node) => node.level === level) ?? nodes[0]

    // Distance from the top of the path. Level 1 sits at the bottom and the
    // origin never moves, so a node's position depends only on its level.
    const centerFromTop = (nodeLevel) => ((MAX_PATH_LEVEL - nodeLevel) * NODE_SPACING) + PATH_PADDING

    const scrollTargetFor = useCallback((nodeLevel) => {

        const container = scrollRef.current

        if(!container) return 0

        return Math.max(0, Math.min(
            centerFromTop(nodeLevel) - (container.clientHeight / 2),
            contentHeight - container.clientHeight,
        ))

    }, [contentHeight])

    const startTween = useCallback((target) => {

        const container = scrollRef.current

        if(!container) return

        tweenRef.current = {
            from: container.scrollTop,
            to: target,
            startedAt: performance.now(),
        }

    }, [])

    useEffect(() => {

        const container = scrollRef.current

        if(!container) return undefined

        if(!hasAnchoredRef.current) {
            container.scrollTop = scrollTargetFor(level)
            hasAnchoredRef.current = true
        }

        const step = () => {

            frameRef.current = requestAnimationFrame(step)

            const tween = tweenRef.current

            if(tween) {
                const progress = Math.min(1, (performance.now() - tween.startedAt) / CAMERA_DURATION_MS)
                container.scrollTop = tween.from + ((tween.to - tween.from) * easeInOutCubic(progress))

                if(progress >= 1) tweenRef.current = null

                return
            }

            if(Date.now() - lastInteractionRef.current < IDLE_RETURN_MS) return

            const target = scrollTargetFor(level)

            if(Math.abs(target - container.scrollTop) > 1) startTween(target)

        }

        frameRef.current = requestAnimationFrame(step)

        return () => cancelAnimationFrame(frameRef.current)

    }, [contentHeight, level, scrollTargetFor, startTween])

    // A level gained while watching takes the view with it, even mid-scroll.
    useEffect(() => {

        if(!hasAnchoredRef.current) return

        lastInteractionRef.current = 0
        startTween(scrollTargetFor(level))

    }, [level, scrollTargetFor, startTween])

    const markInteraction = () => {
        lastInteractionRef.current = Date.now()
        tweenRef.current = null
    }

    const claim = async (nodeLevel) => {

        setClaiming(true)
        setError('')

        try {
            const result = await claimLevel(nodeLevel)

            if(result.reward.lumen) {
                celebrateReward({ lumen: result.reward.lumen })
            }
        } catch(claimError) {
            setError(claimError.message)
        } finally {
            setClaiming(false)
        }

    }

    return (
        <div className='relative flex-1 min-h-0 flex flex-col'>

            <div className='pointer-events-none absolute inset-x-0 top-0 h-16 z-10 bg-gradient-to-b from-neutral6 to-transparent' />

            <div
                ref={scrollRef}
                onWheel={markInteraction}
                onPointerDown={markInteraction}
                onTouchStart={markInteraction}
                onKeyDown={markInteraction}
                className='flex-1 min-h-0 overflow-y-auto no-scrollbar'
            >
                <div className='relative w-full' style={{ height: contentHeight }}>

                    {nodes.map((node) => {

                        const isCurrent = node.level === level

                        return (
                            <div
                                key={node.level}
                                className='absolute left-1/2 flex flex-col items-center gap-2'
                                style={{
                                    top: centerFromTop(node.level),
                                    transform: `translate(calc(-50% + ${node.offset}px), -50%)`,
                                }}
                            >
                                <div className='relative flex items-center justify-center'>
                                    {isCurrent ? (
                                        <RadialProgress
                                            value={xp}
                                            max={xpNeeded}
                                            size={node.reward === 'crate' ? 92 : 72}
                                            thickness={9}
                                            fillClassName='text-yellow-400'
                                        >
                                            <RoadmapDot node={node} onClaim={claim} claiming={claiming} />
                                        </RadialProgress>
                                    ) : (
                                        <RoadmapDot node={node} onClaim={claim} claiming={claiming} />
                                    )}
                                </div>

                                <div className='flex flex-col items-center whitespace-nowrap'>
                                    <span className={`text-[0.7rem] ${isCurrent ? 'font-semibold text-neutral0' : 'text-neutral2'}`}>
                                        Level {node.level}
                                    </span>
                                    {isCurrent ? (
                                        <span className='text-[0.65rem] text-neutral2'>
                                            {Math.max(0, xpNeeded - xp)} XP left
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        )
                    })}

                    {/* Rendered once, outside the nodes, so it can travel the path. */}
                    <div
                        className='absolute left-1/2 pointer-events-none transition-[top,transform] duration-[900ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none'
                        style={{
                            top: centerFromTop(level),
                            transform: `translate(calc(-50% + ${(currentNode?.offset ?? 0) - CHARACTER_OFFSET}px), -50%)`,
                        }}
                    >
                        <AvatarModel
                            profile={profile}
                            animation='Idle'
                            className='w-28! h-28!'
                        />
                    </div>

                </div>
            </div>

            {error ? (
                <p role='alert' className='absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-red-400'>{error}</p>
            ) : null}

        </div>
    )
}

export default LevelRoadmap
