import { useEffect, useRef, useState } from 'react'

let nextParticleId = 0

const randomBetween = (minimum, maximum) => minimum + (Math.random() * (maximum - minimum))

const SvgBurstParticles = ({
    burstKey = 0,
    children,
    count = 1,
    delayMs = 0,
    startAt = null,
    disabled = false,
    gravity = 260,
    lifetimeMs = 720,
    originX = 0,
    originY = 0,
    velocityX = [-36, 36],
    velocityY = [42, 82],
    now = Date.now,
}) => {
    const [particles, setParticles] = useState([])
    const previousTimeRef = useRef(null)
    const [velocityXMinimum, velocityXMaximum] = velocityX
    const [velocityYMinimum, velocityYMaximum] = velocityY

    useEffect(() => {
        if(!burstKey || disabled) return () => {}
        const resolvedDelayMs = startAt == null ? delayMs : Math.max(0, Number(startAt) - now())
        const timeoutId = window.setTimeout(() => {
            setParticles((current) => [
                ...current,
                ...Array.from({ length: count }, () => ({
                    id: nextParticleId += 1,
                    ageMs: 0,
                    lifetimeMs: lifetimeMs * randomBetween(0.88, 1.12),
                    rotation: randomBetween(-18, 18),
                    rotationSpeed: randomBetween(-900, 900),
                    velocityX: randomBetween(velocityXMinimum, velocityXMaximum),
                    velocityY: randomBetween(velocityYMinimum, velocityYMaximum),
                    x: originX,
                    y: originY,
                })),
            ])
        }, Math.max(0, resolvedDelayMs))
        return () => window.clearTimeout(timeoutId)
    }, [burstKey, count, delayMs, disabled, lifetimeMs, now, originX, originY, startAt, velocityXMaximum, velocityXMinimum, velocityYMaximum, velocityYMinimum])

    useEffect(() => {
        if(!particles.length) {
            previousTimeRef.current = null
            return () => {}
        }
        let frameId = null
        const animate = (time) => {
            const previousTime = previousTimeRef.current ?? time
            const deltaSeconds = Math.min(0.05, Math.max(0, time - previousTime) / 1000)
            previousTimeRef.current = time
            setParticles((current) => current
                .map((particle) => ({
                    ...particle,
                    ageMs: particle.ageMs + (deltaSeconds * 1000),
                    rotation: particle.rotation + (particle.rotationSpeed * deltaSeconds),
                    velocityY: particle.velocityY + (gravity * deltaSeconds),
                    x: particle.x + (particle.velocityX * deltaSeconds),
                    y: particle.y + (particle.velocityY * deltaSeconds),
                }))
                .filter((particle) => particle.ageMs < particle.lifetimeMs))
            frameId = window.requestAnimationFrame(animate)
        }
        frameId = window.requestAnimationFrame(animate)
        return () => window.cancelAnimationFrame(frameId)
    }, [gravity, particles.length])

    if(disabled || !particles.length) return null

    return particles.map((particle) => {
        const life = Math.max(0, 1 - (particle.ageMs / particle.lifetimeMs))
        return (
            <g
                key={particle.id}
                opacity={Math.min(1, life * 1.8)}
                transform={`translate(${particle.x} ${particle.y}) rotate(${particle.rotation}) scale(${0.72 + (life * 0.28)})`}
            >
                {children}
            </g>
        )
    })
}

export default SvgBurstParticles
