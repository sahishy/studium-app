import { useEffect, useRef, useState } from 'react'

const easeOut = (progress) => 1 - Math.pow(1 - progress, 3)

const useAnimatedNumber = (value, { durationMs = 650 } = {}) => {

    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0
    const [displayValue, setDisplayValue] = useState(safeValue)
    const frameRef = useRef(null)
    const fromRef = useRef(safeValue)

    useEffect(() => {

        const from = fromRef.current

        if(from === safeValue) return undefined

        const prefersReducedMotion = typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

        if(prefersReducedMotion) {
            fromRef.current = safeValue
            setDisplayValue(safeValue)
            return undefined
        }

        const startedAt = performance.now()

        const step = (now) => {
            const progress = Math.min(1, (now - startedAt) / durationMs)
            const next = Math.round(from + ((safeValue - from) * easeOut(progress)))

            fromRef.current = next
            setDisplayValue(next)

            if(progress < 1) {
                frameRef.current = requestAnimationFrame(step)
            }
        }

        frameRef.current = requestAnimationFrame(step)

        return () => cancelAnimationFrame(frameRef.current)

    }, [durationMs, safeValue])

    return displayValue
}

export default useAnimatedNumber
