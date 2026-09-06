import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import SvgBurstParticles from '../../../../../shared/components/svg/SvgBurstParticles'
import { getPlaybackView, shotKey } from '../punctureShotLedger'

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

const rotationDegreesAt = ({ now, roundStartedAt, rotationTurnsPerSecond, slowdownStartedAt, reducedMotion }) => {
    if(!roundStartedAt) return 0
    const speedDegreesPerSecond = Number(rotationTurnsPerSecond) * 360
    const roundStart = Number(roundStartedAt)
    const stopStart = Number(slowdownStartedAt)
    if(!stopStart || now <= stopStart) return speedDegreesPerSecond * (Math.max(0, now - roundStart) / 1000)
    const elapsedBeforeStop = Math.max(0, stopStart - roundStart) / 1000
    if(reducedMotion) return speedDegreesPerSecond * elapsedBeforeStop
    const stopProgress = Math.min(1, Math.max(0, now - stopStart) / ROTATION_STOP_DURATION_MS)
    const easedStopSeconds = (ROTATION_STOP_DURATION_MS / 1000) * (stopProgress - ((stopProgress * stopProgress) / 2))
    return speedDegreesPerSecond * (elapsedBeforeStop + easedStopSeconds)
}

const Pin = ({ angle, color, generated = false }) => {
    const base = pointAt(angle, PIN_STEM_START)
    const stemEnd = pointAt(angle, PIN_STEM_END)
    const head = pointAt(angle, PIN_HEAD_DISTANCE)
    return (
        <g style={{ color: generated ? CIRCLE_COLOR : color }}>
            <line x1={base.x} y1={base.y} x2={stemEnd.x} y2={stemEnd.y} stroke='currentColor' strokeWidth={PIN_LINE_WIDTH} strokeLinecap='round' />
            <circle cx={head.x} cy={head.y} r={PIN_BALL_RADIUS} fill='currentColor' stroke='none' />
        </g>
    )
}

const ShotPulse = ({ color, target, isMoving, durationMs }) => {
    const translateX = isMoving ? target.x - CENTER_X : 0
    const translateY = isMoving ? target.y - 275 : 0
    return (
        <g style={{ color }}>
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

const UpcomingPinTower = ({ pinsRemaining, isLaunching, isMoving, durationMs, color }) => {
    const visiblePins = Math.min(MAX_VISIBLE_UPCOMING_PINS, Math.max(0, Number(pinsRemaining) || 0))
    const offset = isLaunching && !isMoving ? TOWER_BALL_SPACING : 0
    return (
        <g
            style={{
                color,
                transform: `translateY(${offset}px)`,
                transition: isLaunching && isMoving ? `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none',
                willChange: 'transform',
            }}
        >
            {Array.from({ length: visiblePins }, (_, index) => (
                <circle key={index} cx={CENTER_X} cy={275 + (index * TOWER_BALL_SPACING)} r={PIN_BALL_RADIUS} fill='currentColor' stroke='none' />
            ))}
        </g>
    )
}

const PunctureScene = ({
    generatedPinAngles = [],
    attachedPinAngles = [],
    rotationTurnsPerSecond = 0,
    roundStartedAt = null,
    roundIndex = 0,
    playbackResetKey = 0,
    pinsRemaining = 0,
    shotEvents = [],
    slowdownStartedAt = null,
    playerColor = '#60a5fa',
    serverNow = Date.now,
}) => {
    const [reducedMotion, setReducedMotion] = useState(false)
    const [queue, setQueue] = useState([])
    const [activeLaunch, setActiveLaunch] = useState(null)
    const [lastImpact, setLastImpact] = useState(null)
    const rotationGroupRef = useRef(null)
    const seenShotKeysRef = useRef(new Set())
    const playbackIdentityRef = useRef(null)
    const timingRef = useRef(null)
    timingRef.current = { roundStartedAt, rotationTurnsPerSecond, slowdownStartedAt, reducedMotion }

    useEffect(() => {
        const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
        if(!media) return () => {}
        const update = () => setReducedMotion(media.matches)
        update()
        media.addEventListener?.('change', update)
        return () => media.removeEventListener?.('change', update)
    }, [])

    // Rotation is the only continuously changing visual. Updating the SVG transform directly
    // avoids rendering both React scene trees on every animation frame.
    useEffect(() => {
        let frameId = null
        const animate = () => {
            const degrees = rotationDegreesAt({ now: serverNow(), ...timingRef.current })
            rotationGroupRef.current?.setAttribute('transform', `rotate(${degrees} ${CENTER_X} ${CENTER_Y})`)
            frameId = window.requestAnimationFrame(animate)
        }
        frameId = window.requestAnimationFrame(animate)
        return () => window.cancelAnimationFrame(frameId)
    }, [serverNow])

    // Receipts append once. Existing receipts on mount/reconnect become the baseline; an ack can
    // replace a queued prediction by key without restarting its animation.
    useLayoutEffect(() => {
        const playbackIdentity = `${roundIndex}:${playbackResetKey}`
        const currentByKey = new Map(shotEvents.map((shot) => [shotKey(shot), shot]).filter(([key]) => key))
        if(playbackIdentityRef.current !== playbackIdentity) {
            playbackIdentityRef.current = playbackIdentity
            seenShotKeysRef.current = new Set(currentByKey.keys())
            setQueue([])
            setActiveLaunch(null)
            setLastImpact(null)
            return
        }
        if(reducedMotion) {
            currentByKey.forEach((_, key) => seenShotKeysRef.current.add(key))
            setQueue([])
            setActiveLaunch(null)
            return
        }
        setQueue((current) => {
            let changed = false
            const retained = current
                .filter((entry) => currentByKey.has(entry.key))
                .map((entry) => {
                    const updatedShot = currentByKey.get(entry.key)
                    if(updatedShot === entry.shot) return entry
                    changed = true
                    return { ...entry, shot: updatedShot }
                })
            if(retained.length !== current.length) changed = true
            const incoming = []
            shotEvents.forEach((shot) => {
                const key = shotKey(shot)
                if(!key || seenShotKeysRef.current.has(key)) return
                seenShotKeysRef.current.add(key)
                incoming.push({ key, shot })
            })
            return incoming.length || changed ? [...retained, ...incoming] : current
        })
        setActiveLaunch((current) => {
            if(!current) return current
            const updatedShot = currentByKey.get(current.key)
            if(!updatedShot) return null
            return updatedShot === current.shot ? current : { ...current, shot: updatedShot }
        })
    }, [playbackResetKey, reducedMotion, roundIndex, shotEvents])

    useLayoutEffect(() => {
        if(activeLaunch || reducedMotion || !queue.length) return
        const [next, ...remaining] = queue
        const visualImpactAt = serverNow() + LAUNCH_DURATION_MS
        const rotationAtImpact = rotationDegreesAt({ now: visualImpactAt, ...timingRef.current })
        const target = pointAt(Number(next.shot.targetAngle) + rotationAtImpact, PIN_HEAD_DISTANCE)
        setQueue(remaining)
        setActiveLaunch({ ...next, target, visualImpactAt, isMoving: false, durationMs: LAUNCH_DURATION_MS })
    }, [activeLaunch, queue, reducedMotion, serverNow])

    // Completion depends only on the launch key. Ack replacement cannot cancel this timer and
    // strand a pin between the tower and wheel.
    useLayoutEffect(() => {
        const launchKey = activeLaunch?.key
        if(!launchKey || reducedMotion) return () => {}
        let timeoutId = null
        const frameId = window.requestAnimationFrame(() => {
            setActiveLaunch((current) => current?.key === launchKey ? { ...current, isMoving: true } : current)
            timeoutId = window.setTimeout(() => {
                setActiveLaunch((current) => {
                    if(current?.key !== launchKey) return current
                    if(current.shot.hit) setLastImpact({ key: launchKey, startedAt: serverNow(), target: current.target })
                    return null
                })
            }, LAUNCH_DURATION_MS)
        })
        return () => {
            window.cancelAnimationFrame(frameId)
            if(timeoutId != null) window.clearTimeout(timeoutId)
        }
    }, [activeLaunch?.key, reducedMotion, serverNow])

    const { displayPinsRemaining, visibleAttachedPinAngles } = getPlaybackView({
        pinsRemaining,
        attachedPinAngles,
        queuedShots: queue.map((entry) => entry.shot),
        activeShot: activeLaunch?.shot,
    })

    return (
        <svg className='absolute inset-0 h-full w-full' viewBox='0 0 320 320' role='img' aria-label='Rotating Puncture circle' preserveAspectRatio='xMidYMid meet'>
            <g ref={rotationGroupRef} transform={`rotate(0 ${CENTER_X} ${CENTER_Y})`}>
                <circle cx={CENTER_X} cy={CENTER_Y} r={CIRCLE_RADIUS} fill={CIRCLE_COLOR} stroke='none' />
                {generatedPinAngles.map((angle, index) => <Pin key={`generated-${index}-${angle}`} angle={angle} generated />)}
                {visibleAttachedPinAngles.map((angle, index) => <Pin key={`attached-${index}-${angle}`} angle={angle} color={playerColor} />)}
            </g>

            <text x={CENTER_X} y={CENTER_Y + 9} fill='white' textAnchor='middle' fontSize='28' fontWeight='700'>{displayPinsRemaining}</text>

            <UpcomingPinTower
                pinsRemaining={displayPinsRemaining}
                isLaunching={Boolean(activeLaunch)}
                isMoving={Boolean(activeLaunch?.isMoving)}
                durationMs={activeLaunch?.durationMs ?? LAUNCH_DURATION_MS}
                color={playerColor}
            />
            {activeLaunch && !reducedMotion ? (
                <ShotPulse color={playerColor} target={activeLaunch.target} isMoving={Boolean(activeLaunch.isMoving)} durationMs={activeLaunch.durationMs} />
            ) : null}
            <SvgBurstParticles
                burstKey={lastImpact?.key ?? 0}
                startAt={lastImpact?.startedAt}
                disabled={reducedMotion}
                gravity={300}
                lifetimeMs={760}
                originX={lastImpact?.target?.x ?? CENTER_X}
                originY={lastImpact?.target?.y ?? (CENTER_Y + PIN_HEAD_DISTANCE)}
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
