import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

const DEFAULT_COUNT = 40

const CubeBurstParticles = ({
    burstKey = 0,
    color = '#a3a3a3',
    count = DEFAULT_COUNT,
    particlesPerBurst = 9,
    position = [0, 0, 0],
    size = 0.075,
}) => {
    const meshRef = useRef(null)
    const nextParticleRef = useRef(0)
    const particlesRef = useRef([])
    const dummy = useMemo(() => new THREE.Object3D(), [])
    const [positionX, positionY, positionZ] = position

    useEffect(() => {
        if(!burstKey) return

        const burstCount = Math.min(count, particlesPerBurst)
        for(let index = 0; index < burstCount; index += 1) {
            const slot = nextParticleRef.current % count
            const angle = Math.random() * Math.PI * 2
            const outwardSpeed = 0.7 + (Math.random() * 1.1)
            particlesRef.current[slot] = {
                age: 0,
                lifetime: 0.42 + (Math.random() * 0.28),
                position: new THREE.Vector3(positionX, positionY, positionZ),
                rotation: new THREE.Vector3(Math.random(), Math.random(), Math.random()),
                velocity: new THREE.Vector3(
                    Math.cos(angle) * outwardSpeed,
                    0.65 + (Math.random() * 1.15),
                    Math.sin(angle) * outwardSpeed,
                ),
            }
            nextParticleRef.current += 1
        }
    }, [burstKey, count, particlesPerBurst, positionX, positionY, positionZ])

    useFrame((_, delta) => {
        if(!meshRef.current) return

        for(let index = 0; index < count; index += 1) {
            const particle = particlesRef.current[index]
            if(!particle || particle.age >= particle.lifetime) {
                dummy.position.set(0, -100, 0)
                dummy.scale.setScalar(0)
            } else {
                particle.age += delta
                particle.velocity.y -= 3.8 * delta
                particle.position.addScaledVector(particle.velocity, delta)
                particle.rotation.x += delta * 7
                particle.rotation.y += delta * 9

                const life = Math.max(0, 1 - (particle.age / particle.lifetime))
                dummy.position.copy(particle.position)
                dummy.rotation.set(particle.rotation.x, particle.rotation.y, particle.rotation.z)
                dummy.scale.setScalar(life)
            }
            dummy.updateMatrix()
            meshRef.current.setMatrixAt(index, dummy.matrix)
        }
        meshRef.current.instanceMatrix.needsUpdate = true
    })

    return (
        <instancedMesh ref={meshRef} args={[null, null, count]} frustumCulled={false}>
            <boxGeometry args={[size, size, size]} />
            <meshStandardMaterial color={color} roughness={0.8} />
        </instancedMesh>
    )
}

export default CubeBurstParticles
