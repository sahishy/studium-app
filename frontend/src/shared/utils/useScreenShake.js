import { useCallback, useEffect, useRef } from 'react'

const SCREEN_SHAKE_PRESETS = {
    subtle: { intensity: 4.5, rotation: 0.16, duration: 150, samples: 9 },
    impact: { intensity: 10, rotation: 0.38, duration: 340, samples: 11 },
}

const randomSigned = () => (Math.random() * 2) - 1
const noisyOffset = () => randomSigned() * (0.45 + (Math.random() * 0.55))

const createNoiseKeyframes = ({ intensity, rotation, samples }) => (
    Array.from({ length: samples }, (_, index) => {
        const isEndpoint = index === 0 || index === samples - 1
        const decay = isEndpoint ? 0 : 1 - (index / (samples - 1))
        return {
            transform: `translate3d(${noisyOffset() * intensity * decay}px, ${noisyOffset() * intensity * decay}px, 0) rotate(${noisyOffset() * rotation * decay}deg)`,
        }
    })
)

const useScreenShake = () => {
    const screenShakeRef = useRef(null)
    const activeAnimationRef = useRef(null)

    const shake = useCallback((preset = 'subtle') => {
        const element = screenShakeRef.current
        if(!element || typeof element.animate !== 'function') return
        if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

        const settings = typeof preset === 'string'
            ? SCREEN_SHAKE_PRESETS[preset] ?? SCREEN_SHAKE_PRESETS.subtle
            : { ...SCREEN_SHAKE_PRESETS.subtle, ...preset }

        activeAnimationRef.current?.cancel()
        activeAnimationRef.current = element.animate(
            createNoiseKeyframes(settings),
            {
                duration: settings.duration,
                easing: 'cubic-bezier(0.2, 0.7, 0.25, 1)',
            },
        )
    }, [])

    useEffect(() => () => activeAnimationRef.current?.cancel(), [])

    return { screenShakeRef, shake }
}

export { SCREEN_SHAKE_PRESETS }
export default useScreenShake
