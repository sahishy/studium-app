import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, useAnimations, useGLTF } from '@react-three/drei'
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { AvatarSceneModel } from '../../../../../shared/components/avatar/AvatarModel'
import wingsModelUrl from '../../../../../assets/models/wings.glb'
import { EMPTY_FLUTTER_INPUT, extrapolateFlutterState } from '../flutterPrediction'

const EMPTY_PENDING_INPUTS = []
/**
 * How fast a correction is absorbed, per second. This is deliberately NOT a lerp toward the
 * target: a first-order lag filter chasing a moving target keeps a permanent error of
 * speed/rate - 0.26 world units at full speed even at rate 25 - which is the same kind of
 * silent positional bias this whole change exists to remove. Instead the drawn position tracks
 * the target exactly and carries a decaying offset, so it is only ever displaced while a real
 * correction is being smoothed out, and never merely because the avatar is moving.
 *
 * The opponent's rate is slower because their corrections are larger: their target is pure dead
 * reckoning off the last input they sent, so it steps by whatever that mispredicted each time a
 * fresh snapshot lands, and a slow absorption hides that better than a fast one.
 */
const LOCAL_CORRECTION_RATE = 18
const OPPONENT_CORRECTION_RATE = 7
/** Beyond this the change is a discontinuity (round reset, resync, reconnect), not a correction:
 * take it immediately rather than sliding the avatar across the arena. */
const SNAP_DISTANCE = 2.5
/** Depth past the avatar plane at which a ring stops being drawn. */
const RING_RETIRE_Z = 0.5

const FlutterCamera = () => {
    const { camera } = useThree()

    useEffect(() => {
        camera.position.set(0, 2.1, 11.5)
        camera.lookAt(0, 0.3, -18)
        camera.updateProjectionMatrix()
    }, [camera])

    return null
}

const ringZ = (ring, now, slowdownStartedAt) => {
    const speed = Number(ring.speed || 1)
    if(!slowdownStartedAt) return -(((Number(ring.passAt) - now) / 1000) * speed)
    const stopDurationSeconds = 1.5
    const elapsedSeconds = Math.max(0, (now - Number(slowdownStartedAt)) / 1000)
    const decelerationTime = Math.min(stopDurationSeconds, elapsedSeconds)
    const zAtSlowdown = -((Number(ring.passAt) - Number(slowdownStartedAt)) / 1000) * speed
    return zAtSlowdown + (speed * (decelerationTime - ((decelerationTime * decelerationTime) / (2 * stopDurationSeconds))))
}

const ringOpacity = (z) => Math.max(0.12, Math.min(1, 1 - (Math.max(0, -z - 10) / 75)))

/**
 * Advanced every frame off the synced clock, not from a `now` prop refreshed on a 50ms React
 * interval. At the fastest ring cadence a ring travels ~1.15 world units per 50ms, so the old
 * 20Hz stepping both read as stutter and left the ring visibly short of (or already past) the
 * avatar plane at the moment RingPassEffects - which has always run per frame - fired its
 * completion burst. Both halves of the effect now read one clock at one rate.
 */
const FlutterRing = ({ ring, serverNow, slowdownStartedAt = null }) => {
    const groupRef = useRef(null)
    const materialRef = useRef(null)
    const color = ring.index % 2 === 0 ? '#7dd3fc' : '#c4b5fd'
    const initialZ = ringZ(ring, serverNow(), slowdownStartedAt)

    useFrame(() => {
        if(!groupRef.current) return
        const z = ringZ(ring, serverNow(), slowdownStartedAt)
        groupRef.current.position.z = z
        // Retire the ring the instant it is behind the player, where PassedRingEffect takes over.
        // The server now holds a ring open for a short grace after its plane so late inputs still
        // count (RING_RESOLVE_GRACE_MS), and it stays in the published window for that whole time;
        // without this it would visibly drift on past the avatar while being scored.
        groupRef.current.visible = z <= RING_RETIRE_Z
        if(materialRef.current) materialRef.current.opacity = ringOpacity(z)
    })

    return (
        <group ref={groupRef} position={[Number(ring.x) || 0, Number(ring.y) || 0, initialZ]}>
            <mesh>
                <torusGeometry args={[Number(ring.innerRadius) + 0.2, 0.2, 14, 48]} />
                <meshStandardMaterial
                    ref={materialRef}
                    color={color}
                    transparent
                    opacity={ringOpacity(initialZ)}
                    roughness={0.9}
                    metalness={0}
                />
            </mesh>
        </group>
    )
}

const PassedRingEffect = ({ ring, startedAt }) => {
    const mainRef = useRef(null)
    const firstPulseRef = useRef(null)
    const secondPulseRef = useRef(null)
    const color = ring.index % 2 === 0 ? '#7dd3fc' : '#c4b5fd'

    useFrame(() => {
        const elapsed = Math.max(0, (Date.now() - startedAt) / 1000)
        if(mainRef.current) {
            const progress = Math.min(1, elapsed / 0.28)
            const eased = 1 - Math.pow(1 - progress, 3)
            mainRef.current.scale.setScalar(1 + eased * 0.08)
            mainRef.current.material.opacity = (1 - eased) * 0.82
        }

        const updatePulse = (mesh, delay, duration, maxScale, maxOpacity) => {
            if(!mesh) return
            const progress = THREE.MathUtils.clamp((elapsed - delay) / duration, 0, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            mesh.scale.setScalar(1 + eased * maxScale)
            mesh.material.opacity = Math.sin(progress * Math.PI) * maxOpacity
        }
        updatePulse(firstPulseRef.current, 0.02, 0.62, 0.42, 0.18)
        updatePulse(secondPulseRef.current, 0.12, 0.7, 0.56, 0.14)
    })

    const radius = Number(ring.innerRadius) + 0.2
    return (
        <group position={[Number(ring.x) || 0, Number(ring.y) || 0, 0.04]}>
            <mesh ref={mainRef}>
                <torusGeometry args={[radius, 0.2, 14, 48]} />
                <meshStandardMaterial color={color} transparent opacity={0.82} roughness={0.9} metalness={0} depthWrite={false} />
            </mesh>
            <mesh ref={firstPulseRef}>
                <torusGeometry args={[radius, 0.055, 10, 48]} />
                <meshBasicMaterial color='#6b7280' transparent opacity={0} depthWrite={false} />
            </mesh>
            <mesh ref={secondPulseRef}>
                <torusGeometry args={[radius, 0.04, 10, 48]} />
                <meshBasicMaterial color='#9ca3af' transparent opacity={0} depthWrite={false} />
            </mesh>
        </group>
    )
}

const RING_PASS_EFFECT_MS = 900

/**
 * How far past its pass time a ring may still fire its burst. At 60fps a pass is detected within
 * a frame or two, so anything older than this means the loop was not running - a backgrounded tab
 * or a large clock correction - and firing every ring the window has accumulated at once would
 * just be a burst of confetti for passes the player never saw.
 */
const RING_PASS_STALE_MS = 250

// Detects a ring pass from the ring's own `passAt` against the synced clock, every frame -
// instead of waiting for the server's next snapshot to shift the visible-ring window out from
// under it. Every ring in the window already carries the exact time it will be passed, so there
// is no reason for this "juice" effect to wait on a round trip.
const RingPassEffects = ({ rings, roundKey, serverNow = Date.now, slowdownStartedAt = null }) => {
    const [effects, setEffects] = useState([])
    const ringsRef = useRef(rings)
    const firedIndexesRef = useRef(new Set())
    const removalTimersRef = useRef(new Set())
    ringsRef.current = rings

    useEffect(() => () => {
        removalTimersRef.current.forEach((timer) => clearTimeout(timer))
        removalTimersRef.current.clear()
    }, [])

    useEffect(() => {
        firedIndexesRef.current.clear()
        removalTimersRef.current.forEach((timer) => clearTimeout(timer))
        removalTimersRef.current.clear()
        setEffects([])
    }, [roundKey])

    useFrame(() => {
        // Once the round has resolved the rings decelerate to a halt on screen, but their passAt
        // stamps are fixed points on the clock and keep elapsing in real time - and on a miss the
        // engine leaves flutterRingIndex parked on the ring it scored, so the published window
        // never moves either. Left alone, every remaining ring in that frozen window fires its
        // completion burst during the result overlay, for passes that never happened.
        if(slowdownStartedAt) return
        const now = serverNow()
        for(const ring of ringsRef.current) {
            if(firedIndexesRef.current.has(ring.index) || Number(ring.passAt) > now) continue
            firedIndexesRef.current.add(ring.index)
            if(now - Number(ring.passAt) > RING_PASS_STALE_MS) continue
            const id = `${roundKey}-${ring.index}`
            setEffects((current) => [...current, { ring, startedAt: Date.now(), id }])
            const timer = setTimeout(() => {
                removalTimersRef.current.delete(timer)
                setEffects((current) => current.filter((entry) => entry.id !== id))
            }, RING_PASS_EFFECT_MS)
            removalTimersRef.current.add(timer)
        }
    })

    return effects.map((effect) => (
        <PassedRingEffect key={effect.id} ring={effect.ring} startedAt={effect.startedAt} />
    ))
}

const FlutterWings = ({ opacity = 1, ...groupProps }) => {
    const groupRef = useRef(null)
    const { scene, animations } = useGLTF(wingsModelUrl)
    const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene])
    const { actions } = useAnimations(animations, groupRef)

    useEffect(() => {
        clonedScene.traverse((object) => {
            if(!object.isMesh) return
            object.castShadow = true
            const materials = Array.isArray(object.material) ? object.material : [object.material]
            object.material = materials.map((material) => {
                if(!material) return material
                const next = material.clone()
                next.transparent = opacity < 1 || next.transparent
                next.opacity = Math.max(0, Math.min(1, opacity))
                next.depthWrite = opacity >= 1
                next.side = THREE.DoubleSide
                return next
            })
            if(object.material.length === 1) object.material = object.material[0]
        })
    }, [clonedScene, opacity])

    useEffect(() => {
        const action = actions?.['Take 001']
        if(!action) return
        action.reset()
        action.enabled = true
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.play()
        return () => action.stop()
    }, [actions])

    return (
        <group ref={groupRef} {...groupProps}>
            <primitive object={clonedScene} />
        </group>
    )
}

const FlightAvatar = ({ player, local = false, pendingInputsRef = null, winner = false, falling = false, fallStartedAt = null, resultAnimationKey = 0, serverNow = Date.now }) => {
    const placementRef = useRef(null)
    const positionRef = useRef(new THREE.Vector2(Number(player?.state?.flutterX) || 0, Number(player?.state?.flutterY) || 0))
    const velocityRef = useRef(new THREE.Vector2(Number(player?.state?.flutterVelocityX) || 0, Number(player?.state?.flutterVelocityY) || 0))
    const targetRef = useRef(positionRef.current.clone())
    const offsetRef = useRef(new THREE.Vector2(0, 0))
    const lastAnchorRef = useRef(null)
    const fallOriginRef = useRef(positionRef.current.clone())
    const spin = useMemo(() => {
        const value = String(player?.userId ?? '')
        let hash = 0
        for(let index = 0; index < value.length; index += 1) hash = Math.imul(31, hash) + value.charCodeAt(index) | 0
        return {
            x: 2.8 + (Math.abs(hash % 13) / 10),
            y: (hash % 2 === 0 ? 1 : -1) * (2.1 + (Math.abs(hash % 9) / 10)),
            z: (hash % 3 === 0 ? 1 : -1) * (3.2 + (Math.abs(hash % 7) / 10)),
            drift: (hash % 2 === 0 ? 1 : -1) * (0.55 + (Math.abs(hash % 5) / 10)),
        }
    }, [player?.userId])

    useEffect(() => {
        if(!falling) return
        fallOriginRef.current.set(Number(player?.state?.flutterX) || 0, Number(player?.state?.flutterY) || 0)
        positionRef.current.copy(fallOriginRef.current)
    }, [falling, player?.state?.flutterX, player?.state?.flutterY, resultAnimationKey])

    useFrame((_, delta) => {
        if(!placementRef.current) return
        if(falling && fallStartedAt) {
            const elapsed = Math.max(0, (serverNow() - Number(fallStartedAt)) / 1000)
            placementRef.current.position.set(
                fallOriginRef.current.x + spin.drift * elapsed,
                fallOriginRef.current.y - (3.9 * elapsed * elapsed),
                (local ? 0.25 : -0.2) + elapsed * 0.35,
            )
            placementRef.current.rotation.set(
                -0.32 + spin.x * elapsed,
                Math.PI + spin.y * elapsed,
                spin.z * elapsed,
            )
            return
        }
        // Reconstruct where the server believes this avatar is *right now*, rather than lerping
        // toward the position it published one round trip ago. flutterX/flutterY are only
        // rewritten when the engine processes an input or resolves a ring, so a published
        // position is a snapshot at flutterLastUpdatedAt, and the gap since then is however long
        // the player has been holding their keys rather than one round trip - the old code
        // dead-reckoned forward off the input while simultaneously dragging back toward that
        // stale point. The resulting bias runs past the 1.65-unit ring tolerance after roughly
        // 350ms of held input and reaches several units on an ordinary flight, which is what made
        // cleanly-flown rings register as misses (see games/flutter-reconciliation.test.js, which
        // measures both strategies against the engine's own verdict). Unacknowledged local inputs
        // are replayed on top, so the local avatar still answers the keyboard on the next frame.
        const now = serverNow()
        const anchoredAt = Number(player?.state?.flutterLastUpdatedAt)
        const target = extrapolateFlutterState({
            x: Number(player?.state?.flutterX) || 0,
            y: Number(player?.state?.flutterY) || 0,
            velocityX: Number(player?.state?.flutterVelocityX) || 0,
            velocityY: Number(player?.state?.flutterVelocityY) || 0,
            input: player?.state?.flutterInput ?? EMPTY_FLUTTER_INPUT,
        }, Number.isFinite(anchoredAt) ? anchoredAt : now, now, pendingInputsRef?.current ?? EMPTY_PENDING_INPUTS)

        targetRef.current.set(target.x, target.y)
        velocityRef.current.set(target.velocityX, target.velocityY)

        // Between snapshots the target is a pure continuous function of the clock, so it needs no
        // smoothing at all - it can only step when a new authoritative anchor arrives. Bank that
        // step as an offset at the moment it happens and decay it to nothing, rather than chasing
        // the target every frame and paying a permanent tracking error for the privilege.
        if(anchoredAt !== lastAnchorRef.current) {
            lastAnchorRef.current = anchoredAt
            offsetRef.current.copy(positionRef.current).sub(targetRef.current)
            if(offsetRef.current.length() > SNAP_DISTANCE) offsetRef.current.set(0, 0)
        }
        offsetRef.current.multiplyScalar(Math.exp(-(local ? LOCAL_CORRECTION_RATE : OPPONENT_CORRECTION_RATE) * delta))
        positionRef.current.copy(targetRef.current).add(offsetRef.current)
        placementRef.current.position.set(positionRef.current.x, positionRef.current.y, local ? 0.25 : -0.2)
        const horizontalTilt = THREE.MathUtils.clamp(velocityRef.current.x * 0.09, -0.48, 0.48)
        const verticalTilt = THREE.MathUtils.clamp(velocityRef.current.y * 0.1, -0.55, 0.55)
        const tiltBlend = Math.min(1, delta * 7)
        placementRef.current.rotation.z = THREE.MathUtils.lerp(placementRef.current.rotation.z, horizontalTilt, tiltBlend)
        placementRef.current.rotation.x = THREE.MathUtils.lerp(placementRef.current.rotation.x, -0.32 + verticalTilt, tiltBlend)
        placementRef.current.rotation.y = THREE.MathUtils.lerp(placementRef.current.rotation.y, Math.PI, tiltBlend)
    })

    const shieldAvailable = Boolean(player?.state?.flutterShieldAvailable)
    return (
        <group ref={placementRef} position={[positionRef.current.x, positionRef.current.y, local ? 0.25 : -0.2]} rotation={[-0.32, Math.PI, 0]}>
            <AvatarSceneModel
                profile={{ avatar: player?.avatar ?? {} }}
                animation={winner ? 'Victory' : 'Idle'}
                animationKey={resultAnimationKey}
                loop={!winner}
                opacity={local ? 1 : 0.4}
                scale={[0.72, 0.72, 0.72]}
            />
            <FlutterWings
                opacity={local ? 1 : 0.4}
                position={[0, 0.18, -0.64]}
                rotation={[0, Math.PI, 0]}
                scale={[0.38, 0.38, 0.38]}
            />
            {shieldAvailable ? (
                <mesh position={[0, 0.2, 0]}>
                    <sphereGeometry args={[1.4, 28, 20]} />
                    <meshPhysicalMaterial
                        color='#7dd3fc'
                        emissive='#38bdf8'
                        emissiveIntensity={0.35}
                        transparent
                        opacity={local ? 0.2 : 0.12}
                        roughness={0.1}
                        metalness={0.05}
                        transmission={0.25}
                        depthWrite={false}
                    />
                </mesh>
            ) : null}
        </group>
    )
}

const FlutterWorld = ({ localPlayer, opponent, rings, pendingInputsRef, resultWinnerUserId, fallingUserIds, slowdownStartedAt, animationKey, serverNow }) => {
    return (
        <>
            <ambientLight intensity={1.4} />
            <directionalLight position={[-4, 7, 8]} intensity={2.4} />
            <directionalLight position={[5, -1, 3]} color='#93c5fd' intensity={1.1} />
            <Stars radius={90} depth={65} count={900} factor={2.2} saturation={0} fade speed={0.35} color='#4b5563' />
            {rings.map((ring) => <FlutterRing key={ring.index} ring={ring} serverNow={serverNow} slowdownStartedAt={slowdownStartedAt} />)}
            <RingPassEffects rings={rings} roundKey={animationKey} serverNow={serverNow} slowdownStartedAt={slowdownStartedAt} />
            <FlightAvatar
                player={opponent}
                winner={Boolean(resultWinnerUserId) && resultWinnerUserId === opponent?.userId}
                falling={fallingUserIds.includes(opponent?.userId)}
                fallStartedAt={slowdownStartedAt}
                resultAnimationKey={animationKey}
                serverNow={serverNow}
            />
            <FlightAvatar
                player={localPlayer}
                local
                pendingInputsRef={pendingInputsRef}
                winner={Boolean(resultWinnerUserId) && resultWinnerUserId === localPlayer?.userId}
                falling={fallingUserIds.includes(localPlayer?.userId)}
                fallStartedAt={slowdownStartedAt}
                resultAnimationKey={animationKey}
                serverNow={serverNow}
            />
        </>
    )
}

// Memoised deliberately. Nothing in this subtree is driven by React state any more - rings and
// avatars both advance in useFrame off the synced clock - so a HUD re-render (the game's 50ms
// clock tick) must not walk the whole react-three-fiber tree 20 times a second alongside it.
const FlutterScene = memo(({ localPlayer, opponent, rings = [], pendingInputsRef = null, resultWinnerUserId = null, fallingUserIds = [], slowdownStartedAt = null, animationKey = 0, serverNow = Date.now }) => (
    <Canvas
        className='absolute inset-0 h-full! w-full!'
        dpr={[1, 2]}
        camera={{ fov: 44, near: 0.1, far: 130 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
        <FlutterCamera />
        <Suspense fallback={null}>
            <FlutterWorld
                localPlayer={localPlayer}
                opponent={opponent}
                rings={rings}
                pendingInputsRef={pendingInputsRef}
                resultWinnerUserId={resultWinnerUserId}
                fallingUserIds={fallingUserIds}
                slowdownStartedAt={slowdownStartedAt}
                animationKey={animationKey}
                serverNow={serverNow}
            />
        </Suspense>
    </Canvas>
))

export default FlutterScene

useGLTF.preload(wingsModelUrl)
