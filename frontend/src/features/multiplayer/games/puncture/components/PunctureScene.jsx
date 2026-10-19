import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import SvgBurstParticles from '../../../../../shared/components/svg/SvgBurstParticles'
import { shotKey } from '../punctureShotLedger'
import { flightProgress, reconcileFlights, visibleFlightPins } from '../puncturePlayback'

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

const rotationDegreesAt = ({ now, roundStartedAt, rotationTurnsPerSecond, slowdownStartedAt }) => {
    if(!roundStartedAt) return 0
    const speedDegreesPerSecond = Number(rotationTurnsPerSecond) * 360
    const roundStart = Number(roundStartedAt)
    const stopStart = Number(slowdownStartedAt)
    if(!stopStart || now <= stopStart) return speedDegreesPerSecond * (Math.max(0, now - roundStart) / 1000)
    const elapsedBeforeStop = Math.max(0, stopStart - roundStart) / 1000
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
    const [flights, setFlights] = useState([])
    const [lastImpact, setLastImpact] = useState(null)
    const rotationGroupRef = useRef(null)
    const flightNodes = useRef(new Map())
    const flightsRef = useRef(flights)
    flightsRef.current = flights
    const seenShotKeysRef = useRef(new Set())
    const playbackIdentityRef = useRef(null)
    const timingRef = useRef(null)
    timingRef.current = { roundStartedAt, rotationTurnsPerSecond, slowdownStartedAt }

    useLayoutEffect(() => {
        const identity = `${roundIndex}:${playbackResetKey}`
        if(playbackIdentityRef.current !== identity) {
            playbackIdentityRef.current = identity
            seenShotKeysRef.current = new Set(shotEvents.map(shotKey).filter(Boolean))
            setFlights([])
            setLastImpact(null)
            return
        }
        setFlights((current) => reconcileFlights(current, shotEvents, seenShotKeysRef.current, serverNow()))
    }, [playbackResetKey, roundIndex, shotEvents, serverNow])

    // Every shot follows its original timeline. Rendering a new receipt never restarts a flight.
    useEffect(() => {
        let frameId
        const animate = () => {
            const now = serverNow()
            const degrees = rotationDegreesAt({ now, ...timingRef.current })
            rotationGroupRef.current?.setAttribute('transform', `rotate(${degrees} ${CENTER_X} ${CENTER_Y})`)
            const completed = []
            for(const { key, shot } of flightsRef.current) {
                const impactRotation = rotationDegreesAt({ now: Number(shot.impactAt), ...timingRef.current })
                const target = pointAt(Number(shot.targetAngle) + impactRotation, PIN_HEAD_DISTANCE)
                const progress = flightProgress(shot, now)
                const eased = progress * progress
                const node = flightNodes.current.get(key)
                node?.setAttribute('cx', String(CENTER_X + (target.x - CENTER_X) * eased))
                node?.setAttribute('cy', String(275 + (target.y - 275) * eased))
                if(progress >= 1) {
                    completed.push(key)
                    if(shot.hit) setLastImpact({ key, startedAt: Number(shot.impactAt), target })
                }
            }
            if(completed.length) {
                flightsRef.current = flightsRef.current.filter(({ key }) => !completed.includes(key))
                setFlights(flightsRef.current)
            }
            frameId = window.requestAnimationFrame(animate)
        }
        frameId = window.requestAnimationFrame(animate)
        return () => window.cancelAnimationFrame(frameId)
    }, [serverNow])

    const displayPinsRemaining = Math.max(0, Number(pinsRemaining) || 0)
    const visibleAttachedPinAngles = visibleFlightPins(attachedPinAngles, flights)

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
                isLaunching={false}
                isMoving={false}
                durationMs={LAUNCH_DURATION_MS}
                color={playerColor}
            />
            {flights.map(({ key }) => (
                <circle key={key} data-shot-key={key} ref={(node) => { if(node) flightNodes.current.set(key, node); else flightNodes.current.delete(key) }}
                    cx={CENTER_X} cy={275} r={PIN_BALL_RADIUS} fill={playerColor} stroke='none' />
            ))}
            <SvgBurstParticles
                burstKey={lastImpact?.key ?? 0}
                startAt={lastImpact?.startedAt}
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
