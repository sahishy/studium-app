import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AvatarSceneModel } from '../../../../../shared/components/avatar/AvatarModel'
import CubeBurstParticles from '../../../../../shared/components/three/CubeBurstParticles'

const TREE_COLOR = '#8b9099'
const BRANCH_COLOR = '#777c85'

const TimberCamera = () => {
    const { camera } = useThree()

    useEffect(() => {
        camera.position.set(0, 4.3, 11.5)
        camera.lookAt(0, 2.4, 0)
        camera.updateProjectionMatrix()
    }, [camera])

    return null
}

const TimberBranch = ({ side, row, spawnFromAbove = false }) => {
    const meshRef = useRef(null)
    const positionedRef = useRef(false)
    const targetY = 0.95 + (row * 0.9)
    const x = side === 'left' ? -0.72 : 0.72
    const rotationZ = side === 'left' ? -0.12 : 0.12

    useLayoutEffect(() => {
        if(!meshRef.current || positionedRef.current) return
        meshRef.current.position.set(x, targetY + (spawnFromAbove ? 2.6 : 0), 0)
        meshRef.current.rotation.set(0, 0, rotationZ)
        positionedRef.current = true
    }, [rotationZ, spawnFromAbove, targetY, x])

    useFrame((_, delta) => {
        if(!meshRef.current) return
        meshRef.current.position.y += (targetY - meshRef.current.position.y) * Math.min(1, delta * 10)
    })

    return (
        <mesh
            ref={meshRef}
            castShadow
            receiveShadow
        >
            <boxGeometry args={[1.25, 0.16, 0.22]} />
            <meshStandardMaterial color={BRANCH_COLOR} roughness={0.82} />
        </mesh>
    )
}

const TimberAvatar = ({ player, side, actualChops, resultAnimation = null, resultAnimationKey = 0 }) => {
    const placementRef = useRef(null)
    const previousChopsRef = useRef(actualChops)
    const [hitKey, setHitKey] = useState(0)
    const [isHitting, setIsHitting] = useState(false)
    const targetX = side === 'left' ? -1.3 : 1.3

    useEffect(() => {
        if(previousChopsRef.current !== actualChops) {
            setIsHitting(true)
            setHitKey((value) => value + 1)
        }
        previousChopsRef.current = actualChops
    }, [actualChops])

    useFrame((_, delta) => {
        if(!placementRef.current) return
        placementRef.current.position.x += (targetX - placementRef.current.position.x) * Math.min(1, delta * 18)
    })

    const handleAnimationFinished = useCallback(() => setIsHitting(false), [])
    const animation = resultAnimation || (isHitting ? 'TimberHit' : 'TimberIdle')
    const shouldLoop = !resultAnimation && !isHitting

    return (
        <group ref={placementRef} position={[targetX, -0.15, -0.1]}>
            <AvatarSceneModel
                profile={{ avatar: player?.avatar ?? {} }}
                animation={animation}
                animationKey={resultAnimation ? resultAnimationKey : hitKey}
                loop={shouldLoop}
                fadeDuration={0}
                onAnimationFinished={!resultAnimation && isHitting ? handleAnimationFinished : undefined}
                scale={[side === 'left' ? -0.9 : 0.9, 0.9, 0.9]}
            />
        </group>
    )
}

const TimberWorld = ({ player, branches, actualChops, side, resultAnimation, resultAnimationKey }) => (
    <>
        <ambientLight intensity={1.35} />
        <directionalLight castShadow position={[-3, 6, 5]} intensity={2.1} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <directionalLight position={[4, 2, 3]} intensity={0.65} />

        <mesh receiveShadow position={[0, -1.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[18, 14]} />
            <meshStandardMaterial color='#d8dadd' roughness={1} />
        </mesh>

        <mesh castShadow receiveShadow position={[0, 2.46, 0]}>
            <cylinderGeometry args={[0.3, 0.43, 10, 12]} />
            <meshStandardMaterial color={TREE_COLOR} roughness={0.88} />
        </mesh>

        {branches.map((branch, index) => branch ? (
            <TimberBranch
                key={`${actualChops + index}-${branch}`}
                side={branch}
                row={index}
                spawnFromAbove={actualChops > 0}
            />
        ) : null)}

        <TimberAvatar
            player={player}
            side={side}
            actualChops={actualChops}
            resultAnimation={resultAnimation}
            resultAnimationKey={resultAnimationKey}
        />
        <CubeBurstParticles
            burstKey={actualChops}
            color={TREE_COLOR}
            position={[side === 'left' ? -0.3 : 0.3, 0.25, 0.35]}
            size={0.2}
            count={96}
            particlesPerBurst={6}
        />
    </>
)

const TimberScene = ({ player, branches = [], actualChops = 0, side = 'left', resultAnimation = null, resultAnimationKey = 0 }) => (
    <Canvas
        className='absolute inset-0 h-full! w-full!'
        shadows
        dpr={[1, 2]}
        camera={{ fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
        <TimberCamera />
        <Suspense fallback={null}>
            <TimberWorld
                player={player}
                branches={branches}
                actualChops={actualChops}
                side={side}
                resultAnimation={resultAnimation}
                resultAnimationKey={resultAnimationKey}
            />
        </Suspense>
    </Canvas>
)

export default TimberScene
