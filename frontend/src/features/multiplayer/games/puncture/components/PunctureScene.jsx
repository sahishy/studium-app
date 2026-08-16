import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import SvgBurstParticles from '../../../../../shared/components/svg/SvgBurstParticles'

const CENTER_X = 160
const CENTER_Y = 145
const CIRCLE_RADIUS = 58
const CIRCLE_COLOR = '#71717a'
const PIN_HEAD_DISTANCE = 104
const PIN_BALL_RADIUS = 3.5
const PIN_LINE_WIDTH = 1.25
const PIN_STEM_START = CIRCLE_RADIUS + (PIN_LINE_WIDTH / 2)
const PIN_STEM_END = PIN_HEAD_DISTANCE - (PIN_BALL_RADIUS / 2)
const TOWER_BALL_SPACING = 14
const MAX_VISIBLE_UPCOMING_PINS = 8
const LAUNCH_DURATION_MS = 75
const ROTATION_STOP_DURATION_MS = 700

const pointAt = (angle, distance) => {
    const radians = (Number(angle) * Math.PI) / 180
    return {
        x: CENTER_X + (Math.cos(radians) * distance),
        y: CENTER_Y + (Math.sin(radians) * distance),
    }
}

const Pin = ({ angle, color, generated = false }) => {
    const base = pointAt(angle, PIN_STEM_START)
    const stemEnd = pointAt(angle, PIN_STEM_END)
    const head = pointAt(angle, PIN_HEAD_DISTANCE)
    return (
        <g style={{ color: generated ? CIRCLE_COLOR : color }}>
            <line
                x1={base.x}
                y1={base.y}
                x2={stemEnd.x}
                y2={stemEnd.y}
                stroke='currentColor'
                strokeWidth={PIN_LINE_WIDTH}
                strokeLinecap='round'
            />
            <circle cx={head.x} cy={head.y} r={PIN_BALL_RADIUS} fill='currentColor' stroke='none' />
        </g>
    )
}

const ShotPulse = ({ color, shotCount, target, isMoving, durationMs }) => {
    const translateX = isMoving ? target.x - CENTER_X : 0
    const translateY = isMoving ? target.y - 275 : 0
    return (
        <g key={shotCount} style={{ color }}>
            <circle
                cx={CENTER_X}
                cy='275'
                r={PIN_BALL_RADIUS}
                fill='currentColor'
                stroke='none'
                style={{
                    transform: `translate(${translateX}px, ${translateY}px)`,
                    transition: isMoving ? `transform ${durationMs}ms cubic-bezier(0.4, 0, 1, 1)` : 'none',
                    willChange: 'transform',
                }}
            />
        </g>
    )
}

const UpcomingPinTower = ({ pinsRemaining, shotCount, isLaunching, isMoving, durationMs, color }) => {
    const visiblePins = Math.min(MAX_VISIBLE_UPCOMING_PINS, Math.max(0, Number(pinsRemaining) || 0))
    const targetY = 275
    const offset = isLaunching && !isMoving ? TOWER_BALL_SPACING : 0
    return (
        <g
            key={`tower-${shotCount}`}
            style={{
                color,
                transform: `translateY(${offset}px)`,
                transition: isLaunching && isMoving
                    ? `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
                    : 'none',
                willChange: 'transform',
            }}
        >
            {Array.from({ length: visiblePins }, (_, index) => {
                const y = targetY + (index * TOWER_BALL_SPACING)
                return (
                    <circle key={index} cx={CENTER_X} cy={y} r={PIN_BALL_RADIUS} fill='currentColor' stroke='none' />
                )
            })}
        </g>
    )
}

const PunctureScene = ({
    generatedPinAngles = [],
    attachedPinAngles = [],
    rotationTurnsPerSecond = 0,
    roundStartedAt = null,
    pinsRemaining = 0,
    shotCount = 0,
    lastShotHit = false,
    shotImpactAt = null,
    slowdownStartedAt = null,
    playerColor = '#60a5fa',
    optimisticShot = null,
    lastClientActionId = null,
    serverNow = Date.now,
}) => {
    const [reducedMotion, setReducedMotion] = useState(false)
    const [animationNow, setAnimationNow] = useState(() => serverNow())
    const [launch, setLaunch] = useState(null)
    const previousShotCountRef = useRef(shotCount)

    useEffect(() => {
        const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
        if(!media) return () => {}
        const update = () => setReducedMotion(media.matches)
        update()
        media.addEventListener?.('change', update)
        return () => media.removeEventListener?.('change', update)
    }, [])

    useEffect(() => {
        if(!roundStartedAt) return () => {}
        let frameId = null
        const animate = () => {
            setAnimationNow(serverNow())
            frameId = window.requestAnimationFrame(animate)
        }
        frameId = window.requestAnimationFrame(animate)
        return () => window.cancelAnimationFrame(frameId)
    }, [roundStartedAt, serverNow])

    useLayoutEffect(() => {
        if(!optimisticShot?.id || reducedMotion) return
        const impactAt = Number(optimisticShot.startedAt) + LAUNCH_DURATION_MS
        const launchKey = optimisticShot.id
        setLaunch({ shotCount: launchKey, successful: false, target: pointAt(90, PIN_HEAD_DISTANCE), impactAt, isMoving: false, durationMs: LAUNCH_DURATION_MS })
        let timeoutId = null
        const frameId = window.requestAnimationFrame(() => {
            const durationMs = Math.max(1, impactAt - serverNow())
            setLaunch((current) => current?.shotCount === launchKey ? { ...current, isMoving: true, durationMs } : current)
            timeoutId = window.setTimeout(() => setLaunch((current) => current?.shotCount === launchKey ? null : current), durationMs)
        })
        return () => {
            window.cancelAnimationFrame(frameId)
            if(timeoutId != null) window.clearTimeout(timeoutId)
        }
    }, [optimisticShot, reducedMotion, serverNow])

    useLayoutEffect(() => {
        if(previousShotCountRef.current === shotCount) return
        previousShotCountRef.current = shotCount
        if(lastClientActionId && lastClientActionId === optimisticShot?.id) return
        if(reducedMotion) {
            setLaunch(null)
            return
        }
        const newlyAttachedAngle = lastShotHit ? null : attachedPinAngles.at(-1)
        const impactAt = Number(shotImpactAt) || (serverNow() + LAUNCH_DURATION_MS)
        setLaunch({ shotCount, successful: newlyAttachedAngle != null, target: pointAt(90, PIN_HEAD_DISTANCE), impactAt, isMoving: false, durationMs: LAUNCH_DURATION_MS })
        let secondFrameId = null
        let timeoutId = null
        const firstFrameId = window.requestAnimationFrame(() => {
            secondFrameId = window.requestAnimationFrame(() => {
                const durationMs = Math.max(0, impactAt - serverNow())
                if(durationMs <= 0) {
                    setLaunch((current) => current?.shotCount === shotCount ? null : current)
                    return
                }
                setLaunch((current) => current?.shotCount === shotCount
                    ? { ...current, isMoving: true, durationMs }
                    : current)
                timeoutId = window.setTimeout(() => {
                    setLaunch((current) => current?.shotCount === shotCount ? null : current)
                }, durationMs)
            })
        })
        return () => {
            window.cancelAnimationFrame(firstFrameId)
            if(secondFrameId != null) window.cancelAnimationFrame(secondFrameId)
            if(timeoutId != null) window.clearTimeout(timeoutId)
        }
    }, [attachedPinAngles, lastClientActionId, lastShotHit, optimisticShot?.id, reducedMotion, serverNow, shotCount, shotImpactAt])

    const isLaunching = Boolean(launch)
    const visibleAttachedPinAngles = isLaunching && launch?.successful
        ? attachedPinAngles.slice(0, -1)
        : attachedPinAngles

    const rotationDegrees = useMemo(() => {
        if(!roundStartedAt) return 0
        const speedDegreesPerSecond = Number(rotationTurnsPerSecond) * 360
        const roundStart = Number(roundStartedAt)
        const stopStart = Number(slowdownStartedAt)
        if(!stopStart || animationNow <= stopStart) {
            return speedDegreesPerSecond * (Math.max(0, animationNow - roundStart) / 1000)
        }
        const elapsedBeforeStop = Math.max(0, stopStart - roundStart) / 1000
        if(reducedMotion) return speedDegreesPerSecond * elapsedBeforeStop
        const stopProgress = Math.min(1, Math.max(0, animationNow - stopStart) / ROTATION_STOP_DURATION_MS)
        const easedStopSeconds = (ROTATION_STOP_DURATION_MS / 1000) * (stopProgress - ((stopProgress * stopProgress) / 2))
        return speedDegreesPerSecond * (elapsedBeforeStop + easedStopSeconds)
    }, [animationNow, reducedMotion, rotationTurnsPerSecond, roundStartedAt, slowdownStartedAt])

    return (
        <svg
            className='absolute inset-0 h-full w-full'
            viewBox='0 0 320 320'
            role='img'
            aria-label='Rotating Puncture circle'
            preserveAspectRatio='xMidYMid meet'
        >
            <g transform={`rotate(${rotationDegrees} ${CENTER_X} ${CENTER_Y})`}>
                <circle
                    cx={CENTER_X}
                    cy={CENTER_Y}
                    r={CIRCLE_RADIUS}
                    fill={CIRCLE_COLOR}
                    stroke='none'
                />
                {generatedPinAngles.map((angle, index) => (
                    <Pin key={`generated-${index}-${angle}`} angle={angle} generated />
                ))}
                {visibleAttachedPinAngles.map((angle, index) => (
                    <Pin key={`attached-${index}-${angle}`} angle={angle} color={playerColor} />
                ))}
            </g>

            <text x={CENTER_X} y={CENTER_Y + 9} fill='white' textAnchor='middle' fontSize='28' fontWeight='700'>
                {Math.max(0, Number(pinsRemaining) || 0)}
            </text>

            <UpcomingPinTower
                pinsRemaining={pinsRemaining}
                shotCount={shotCount}
                isLaunching={isLaunching}
                isMoving={Boolean(launch?.isMoving)}
                durationMs={launch?.durationMs ?? LAUNCH_DURATION_MS}
                color={playerColor}
            />
            {isLaunching && !reducedMotion ? (
                <ShotPulse
                    shotCount={shotCount}
                    color={playerColor}
                    target={launch.target}
                    isMoving={Boolean(launch.isMoving)}
                    durationMs={launch.durationMs}
                />
            ) : null}
            <SvgBurstParticles
                burstKey={lastShotHit ? shotCount : 0}
                startAt={shotImpactAt}
                disabled={reducedMotion}
                gravity={300}
                lifetimeMs={760}
                originX={CENTER_X}
                originY={CENTER_Y + PIN_HEAD_DISTANCE}
                velocityX={[-42, 42]}
                velocityY={[48, 88]}
                now={serverNow}
            >
                <g style={{ color: playerColor }}>
                    <line x1='0' y1={-(PIN_HEAD_DISTANCE - PIN_STEM_START)} x2='0' y2={-1} stroke='currentColor' strokeWidth={PIN_LINE_WIDTH} strokeLinecap='round' />
                    <circle cx='0' cy='0' r={PIN_BALL_RADIUS} fill='currentColor' stroke='none' />
                </g>
            </SvgBurstParticles>
        </svg>
    )
}

export default memo(PunctureScene)
