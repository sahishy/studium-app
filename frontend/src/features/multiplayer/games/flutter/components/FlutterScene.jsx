import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, useAnimations, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { AvatarSceneModel } from '../../../../../shared/components/avatar/AvatarModel'
import wingsModelUrl from '../../../../../assets/models/wings.glb'

const MAX_SPEED = 6.4
const FLIGHT_ACCELERATION = 10
const BOUNDS = { x: 5.2, y: 3.15 }

const FlutterCamera = () => {
    const { camera } = useThree()

    useEffect(() => {
        camera.position.set(0, 2.1, 11.5)
        camera.lookAt(0, 0.3, -18)
        camera.updateProjectionMatrix()
    }, [camera])

    return null
}

const FlutterRing = ({ ring, now, slowdownStartedAt = null }) => {
    const speed = Number(ring.speed || 1)
    let z
    if(slowdownStartedAt) {
        const stopDurationSeconds = 1.5
        const elapsedSeconds = Math.max(0, (now - Number(slowdownStartedAt)) / 1000)
        const decelerationTime = Math.min(stopDurationSeconds, elapsedSeconds)
        const zAtSlowdown = -((Number(ring.passAt) - Number(slowdownStartedAt)) / 1000) * speed
        const distanceDuringSlowdown = speed * (decelerationTime - ((decelerationTime * decelerationTime) / (2 * stopDurationSeconds)))
        z = zAtSlowdown + distanceDuringSlowdown
    } else {
        const remainingSeconds = (Number(ring.passAt) - now) / 1000
        z = -(remainingSeconds * speed)
    }
    const opacity = Math.max(0.12, Math.min(1, 1 - (Math.max(0, -z - 10) / 75)))
    const color = ring.index % 2 === 0 ? '#7dd3fc' : '#c4b5fd'

    return (
        <group position={[Number(ring.x) || 0, Number(ring.y) || 0, z]}>
            <mesh>
                <torusGeometry args={[Number(ring.innerRadius) + 0.2, 0.2, 14, 48]} />
                <meshStandardMaterial
                    color={color}
                    transparent
                    opacity={opacity}
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

const RingPassEffects = ({ rings, roundKey }) => {
    const [effects, setEffects] = useState([])
    const previousRingsRef = useRef(new Map())
    const previousRoundKeyRef = useRef(roundKey)
    const removalTimersRef = useRef(new Set())

    useEffect(() => () => {
        removalTimersRef.current.forEach((timer) => clearTimeout(timer))
        removalTimersRef.current.clear()
    }, [])

    useEffect(() => {
        const nextRings = new Map(rings.map((ring) => [ring.index, ring]))
        if(previousRoundKeyRef.current !== roundKey) {
            previousRoundKeyRef.current = roundKey
            previousRingsRef.current = nextRings
            removalTimersRef.current.forEach((timer) => clearTimeout(timer))
            removalTimersRef.current.clear()
            setEffects([])
            return
        }

        if(nextRings.size && previousRingsRef.current.size) {
            const firstVisibleIndex = Math.min(...nextRings.keys())
            const passed = [...previousRingsRef.current.entries()]
                .filter(([index]) => index < firstVisibleIndex)
                .map(([, ring]) => ({ ring, startedAt: Date.now(), id: `${roundKey}-${ring.index}-${Date.now()}` }))
            if(passed.length) {
                setEffects((current) => [...current, ...passed])
                passed.forEach((effect) => {
                    const timer = setTimeout(() => {
                        removalTimersRef.current.delete(timer)
                        setEffects((current) => current.filter((entry) => entry.id !== effect.id))
                    }, 900)
                    removalTimersRef.current.add(timer)
                })
            }
        }
        previousRingsRef.current = nextRings
    }, [rings, roundKey])

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

const FlightAvatar = ({ player, local = false, input, winner = false, falling = false, fallStartedAt = null, resultAnimationKey = 0, serverNow = Date.now }) => {
    const placementRef = useRef(null)
    const positionRef = useRef(new THREE.Vector2(Number(player?.state?.flutterX) || 0, Number(player?.state?.flutterY) || 0))
    const velocityRef = useRef(new THREE.Vector2(Number(player?.state?.flutterVelocityX) || 0, Number(player?.state?.flutterVelocityY) || 0))
    const authoritativeRef = useRef(positionRef.current.clone())
    const fallOriginRef = useRef(positionRef.current.clone())
    const serverInput = player?.state?.flutterInput ?? {}
    const activeInput = local ? input : serverInput
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
        authoritativeRef.current.set(Number(player?.state?.flutterX) || 0, Number(player?.state?.flutterY) || 0)
        const error = positionRef.current.distanceTo(authoritativeRef.current)
        if(error > 2.5) positionRef.current.copy(authoritativeRef.current)
        else positionRef.current.lerp(authoritativeRef.current, local ? 0.35 : 0.55)
        velocityRef.current.set(Number(player?.state?.flutterVelocityX) || 0, Number(player?.state?.flutterVelocityY) || 0)
    }, [local, player?.state?.flutterVelocityX, player?.state?.flutterVelocityY, player?.state?.flutterX, player?.state?.flutterY])

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
        const horizontal = Number(Boolean(activeInput?.right)) - Number(Boolean(activeInput?.left))
        const vertical = Number(Boolean(activeInput?.up)) - Number(Boolean(activeInput?.down))
        const magnitude = Math.hypot(horizontal, vertical) || 1
        const targetX = horizontal / magnitude * MAX_SPEED
        const targetY = vertical / magnitude * MAX_SPEED
        const blend = 1 - Math.exp(-FLIGHT_ACCELERATION * delta)
        velocityRef.current.x += (targetX - velocityRef.current.x) * blend
        velocityRef.current.y += (targetY - velocityRef.current.y) * blend
        positionRef.current.x = THREE.MathUtils.clamp(positionRef.current.x + velocityRef.current.x * delta, -BOUNDS.x, BOUNDS.x)
        positionRef.current.y = THREE.MathUtils.clamp(positionRef.current.y + velocityRef.current.y * delta, -BOUNDS.y, BOUNDS.y)
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

const FlutterWorld = ({ localPlayer, opponent, rings, now, localInput, resultWinnerUserId, fallingUserIds, slowdownStartedAt, animationKey, serverNow }) => {
    return (
        <>
            <ambientLight intensity={1.4} />
            <directionalLight position={[-4, 7, 8]} intensity={2.4} />
            <directionalLight position={[5, -1, 3]} color='#93c5fd' intensity={1.1} />
            <Stars radius={90} depth={65} count={900} factor={2.2} saturation={0} fade speed={0.35} color='#4b5563' />
            {rings.map((ring) => <FlutterRing key={ring.index} ring={ring} now={now} slowdownStartedAt={slowdownStartedAt} />)}
            <RingPassEffects rings={rings} roundKey={animationKey} />
            <FlightAvatar
                player={opponent}
                input={opponent?.state?.flutterInput}
                winner={Boolean(resultWinnerUserId) && resultWinnerUserId === opponent?.userId}
                falling={fallingUserIds.includes(opponent?.userId)}
                fallStartedAt={slowdownStartedAt}
                resultAnimationKey={animationKey}
                serverNow={serverNow}
            />
            <FlightAvatar
                player={localPlayer}
                local
                input={localInput}
                winner={Boolean(resultWinnerUserId) && resultWinnerUserId === localPlayer?.userId}
                falling={fallingUserIds.includes(localPlayer?.userId)}
                fallStartedAt={slowdownStartedAt}
                resultAnimationKey={animationKey}
                serverNow={serverNow}
            />
        </>
    )
}

const FlutterScene = ({ localPlayer, opponent, rings = [], now, localInput, resultWinnerUserId = null, fallingUserIds = [], slowdownStartedAt = null, animationKey = 0, serverNow = Date.now }) => (
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
                now={now}
                localInput={localInput}
                resultWinnerUserId={resultWinnerUserId}
                fallingUserIds={fallingUserIds}
                slowdownStartedAt={slowdownStartedAt}
                animationKey={animationKey}
                serverNow={serverNow}
            />
        </Suspense>
    </Canvas>
)

export default FlutterScene

useGLTF.preload(wingsModelUrl)
